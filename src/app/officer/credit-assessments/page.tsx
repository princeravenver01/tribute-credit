'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  DollarSign,
  X,
  ArrowRight
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
  const [saveErrorMsg, setSaveErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReconsidering, setIsReconsidering] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [modalErrorMsg, setModalErrorMsg] = useState('');
  const triggerBtnRef = useRef<HTMLButtonElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const handledDeepLinkRef = useRef(false);

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

            // Downgrade protection: only infer status from draft if existing assessment is not already further in pipeline
            const existingItem = existingIndex >= 0 ? list[existingIndex] : null;
            const hasAdvancedStatus = existingItem && (
              existingItem.status === 'pending_admin' ||
              existingItem.status === 'admin_approved' ||
              existingItem.status === 'admin_rejected' ||
              existingItem.status === 'contract_ready' ||
              existingItem.status === 'disbursed'
            );

            const determinedStatus: CreditAssessmentItem['status'] = hasAdvancedStatus
              ? existingItem.status
              : draft.isContractFinalized ? 'contract_ready'
              : draft.adminSimulationStatus === 'approved' ? 'admin_approved'
              : draft.adminSimulationStatus === 'rejected' ? 'admin_rejected'
              : (draft.isSubmittedToAdmin ? 'pending_admin' : (existingItem?.status || 'pending_assessment'));

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

      // Check deep link parameter once after local + server records are merged
      if (typeof window !== 'undefined' && !handledDeepLinkRef.current) {
        const params = new URLSearchParams(window.location.search);
        const assessId = params.get('assessId') || params.get('id');
        if (assessId) {
          const target = list.find(a => 
            a.id === assessId || 
            a.applicationId === assessId || 
            (a.policyNo && a.policyNo !== 'LCAP-' && a.policyNo === assessId) ||
            (a.borrowerName && a.borrowerName.toLowerCase() === assessId.toLowerCase())
          );
          if (target) {
            handledDeepLinkRef.current = true;
            setSelectedAssessment(target);
            initScorecardForm(target);
            try {
              params.delete('assessId');
              params.delete('id');
              const newQuery = params.toString();
              const newUrl = window.location.pathname + (newQuery ? `?${newQuery}` : '');
              window.history.replaceState(null, '', newUrl);
            } catch (e) {}
            return;
          }
        }
      }

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
  const handleSaveAssessment = async (submitToAdmin: boolean = false) => {
    if (!selectedAssessment || !editingScorecard || isSubmitting) return;

    setIsSubmitting(true);
    setSaveErrorMsg('');
    setSaveSuccessMsg('');

    const updatedItem: CreditAssessmentItem = {
      ...selectedAssessment,
      fiveCs: editingScorecard,
      officerAdjustedAmount: officerAmount,
      officerRecommendation: recommendation,
      officerNotes: officerNote,
      evaluatedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      status: submitToAdmin ? 'pending_admin' : selectedAssessment.status
    };

    try {
      // 1. Await persistence to server API
      const res = await fetch('/api/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedItem),
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}: Failed to persist assessment`);
      }

      // 2. Persist locally to storage
      const updatedList = saveCreditAssessment(updatedItem);
      setAssessments(updatedList);
      setSelectedAssessment(updatedItem);

      // 3. Synchronize local draft if it matches this application so polling doesn't regress it
      try {
        const draftRaw = localStorage.getItem('tribute_new_borrower_draft');
        if (draftRaw) {
          const draft = JSON.parse(draftRaw);
          const fullName = `${draft.step1?.firstName || ''} ${draft.step1?.middleName || ''} ${draft.step1?.lastName || ''}`.trim();
          const matchesDraft = 
            (draft.applicationId && (draft.applicationId === updatedItem.applicationId || draft.applicationId === updatedItem.id)) ||
            (updatedItem.id && updatedItem.id === `CA-${(draft.applicationId || '').replace('NBR-', '')}`) ||
            (draft.step1?.tgswsPolicyNumber && draft.step1.tgswsPolicyNumber !== 'LCAP-' && draft.step1.tgswsPolicyNumber === updatedItem.policyNo) ||
            (fullName && updatedItem.borrowerName.toLowerCase() === fullName.toLowerCase());

          if (matchesDraft) {
            draft.officerAdjustedAmount = officerAmount;
            draft.officerAdjustmentNote = officerNote;
            if (submitToAdmin) {
              draft.isSubmittedToAdmin = true;
              draft.adminSimulationStatus = 'pending';
            }
            localStorage.setItem('tribute_new_borrower_draft', JSON.stringify(draft));
          }
        }
      } catch (err) {
        console.error('Error synchronizing draft upon endorsement:', err);
      }

      setSaveSuccessMsg(submitToAdmin 
        ? '✓ Assessment endorsed to Admin Approval Queue!' 
        : '✓ Credit assessment score & notes saved successfully.');
      
      setTimeout(() => setSaveSuccessMsg(''), 4000);
    } catch (err: any) {
      console.error('Error saving/endorsing assessment:', err);
      setSaveErrorMsg(err.message || 'Failed to submit assessment to Admin. Please retry.');
      setTimeout(() => setSaveErrorMsg(''), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Validation and opening of In-App Confirmation Modal
  const handleOpenReconsiderationModal = () => {
    if (!selectedAssessment || !editingScorecard || isReconsidering || isSubmitting) return;

    const currentApproved = Number(selectedAssessment.adminApprovedAmount || 0);
    const requestedAmount = Number(officerAmount || 0);
    const currentAdjustments = Number(selectedAssessment.adjustmentCount || 0);

    // 1. Validation: adjustment count cap
    if (currentAdjustments >= 3) {
      setSaveErrorMsg('Maximum reconsideration limit reached (3 of 3). Admin decision is final.');
      return;
    }

    // 2. Validation: amount must differ from current approved
    if (requestedAmount === currentApproved || officerAmount === selectedAssessment.adminApprovedAmount) {
      setSaveErrorMsg(`Recommended Loan Limit (₱${requestedAmount.toLocaleString('en-PH')}) must be different from current Admin-approved amount (₱${currentApproved.toLocaleString('en-PH')}).`);
      return;
    }

    // 3. Validation: justification required
    if (!officerNote.trim()) {
      setSaveErrorMsg('Please provide a specific Officer Endorsement Justification to explain why reconsideration is requested.');
      return;
    }

    setSaveErrorMsg('');
    setModalErrorMsg('');
    setIsConfirmModalOpen(true);
  };

  const handleCloseReconsiderationModal = () => {
    if (isReconsidering) return;
    setIsConfirmModalOpen(false);
    setModalErrorMsg('');
    if (triggerBtnRef.current) {
      triggerBtnRef.current.focus();
    }
  };

  // Keyboard accessibility: Escape closes modal before submission
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isConfirmModalOpen && !isReconsidering) {
        handleCloseReconsiderationModal();
      }
    };
    if (isConfirmModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isConfirmModalOpen, isReconsidering]);

  // Focus trap / initial focus on modal open
  useEffect(() => {
    if (isConfirmModalOpen && modalRef.current) {
      modalRef.current.focus();
    }
  }, [isConfirmModalOpen]);

  // Dedicated AO Reconsideration Request Action (up to 3 times per application)
  const handleConfirmReconsiderationSubmit = async () => {
    if (!selectedAssessment || !editingScorecard || isReconsidering || isSubmitting) return;

    const currentApproved = Number(selectedAssessment.adminApprovedAmount || 0);
    const requestedAmount = Number(officerAmount || 0);
    const currentAdjustments = Number(selectedAssessment.adjustmentCount || 0);

    if (currentAdjustments >= 3) {
      setModalErrorMsg('Maximum reconsideration limit reached (3 of 3). Admin decision is final.');
      return;
    }

    if (requestedAmount === currentApproved || officerAmount === selectedAssessment.adminApprovedAmount) {
      setModalErrorMsg(`Recommended Loan Limit (₱${requestedAmount.toLocaleString('en-PH')}) must be different from current Admin-approved amount (₱${currentApproved.toLocaleString('en-PH')}).`);
      return;
    }

    if (!officerNote.trim()) {
      setModalErrorMsg('Please provide a specific Officer Endorsement Justification to explain why reconsideration is requested.');
      return;
    }

    const nextRound = currentAdjustments + 1;

    setIsReconsidering(true);
    setSaveErrorMsg('');
    setModalErrorMsg('');
    setSaveSuccessMsg('');

    const updatedItem: CreditAssessmentItem = {
      ...selectedAssessment,
      fiveCs: editingScorecard,
      officerAdjustedAmount: requestedAmount,
      officerRecommendation: 'recommend_adjust',
      officerNotes: officerNote,
      reconsiderationJustification: officerNote,
      previousAdminApprovedAmount: currentApproved,
      evaluatedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      status: 'pending_admin',
      adjustmentCount: nextRound,
      maxAdjustmentsReached: nextRound >= 3,
    };

    try {
      // Persist to server API
      const res = await fetch('/api/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedItem),
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}: Failed to submit reconsideration`);
      }

      // Persist to local storage
      const updatedList = saveCreditAssessment(updatedItem);
      setAssessments(updatedList);
      setSelectedAssessment(updatedItem);

      // Synchronize local draft
      try {
        const draftRaw = localStorage.getItem('tribute_new_borrower_draft');
        if (draftRaw) {
          const draft = JSON.parse(draftRaw);
          const fullName = `${draft.step1?.firstName || ''} ${draft.step1?.middleName || ''} ${draft.step1?.lastName || ''}`.trim();
          const matchesDraft = 
            (draft.applicationId && (draft.applicationId === updatedItem.applicationId || draft.applicationId === updatedItem.id)) ||
            (updatedItem.id && updatedItem.id === `CA-${(draft.applicationId || '').replace('NBR-', '')}`) ||
            (draft.step1?.tgswsPolicyNumber && draft.step1.tgswsPolicyNumber !== 'LCAP-' && draft.step1.tgswsPolicyNumber === updatedItem.policyNo) ||
            (fullName && updatedItem.borrowerName.toLowerCase() === fullName.toLowerCase());

          if (matchesDraft) {
            draft.officerAdjustedAmount = requestedAmount;
            draft.officerAdjustmentNote = officerNote;
            draft.isSubmittedToAdmin = true;
            draft.adminSimulationStatus = 'pending';
            draft.adjustmentCount = nextRound;
            draft.maxAdjustmentsReached = nextRound >= 3;
            localStorage.setItem('tribute_new_borrower_draft', JSON.stringify(draft));
          }
        }
      } catch (err) {
        console.error('Error updating draft after reconsideration:', err);
      }

      setIsConfirmModalOpen(false);
      setSaveSuccessMsg(`✓ Reconsideration Round ${nextRound} of 3 submitted to Admin Credit Committee!`);
      setTimeout(() => setSaveSuccessMsg(''), 5000);
      if (triggerBtnRef.current) {
        triggerBtnRef.current.focus();
      }
    } catch (err: any) {
      console.error('Error submitting reconsideration:', err);
      const errMsg = err.message || 'Failed to submit reconsideration to Admin. Previous approval remains active.';
      setModalErrorMsg(errMsg);
      setSaveErrorMsg(errMsg);
      setTimeout(() => setSaveErrorMsg(''), 5000);
    } finally {
      setIsReconsidering(false);
    }
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
          onOpenMobileSidebar={() => setMobileMenuOpen(prev => !prev)}
          actions={
            <Link
              href="/officer/borrowers/new"
              className={styles.primaryHeaderAction}
            >
              <UserCheck size={15} /> New Assessment Intake
            </Link>
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

                {/* Action Feedback Messages */}
                {saveSuccessMsg && (
                  <div style={{
                    backgroundColor: '#dcfce7',
                    border: '1px solid #86efac',
                    color: '#15803d',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    fontSize: '13px',
                    fontWeight: '700'
                  }}>
                    {saveSuccessMsg}
                  </div>
                )}
                {saveErrorMsg && (
                  <div style={{
                    backgroundColor: '#fee2e2',
                    border: '1px solid #fecaca',
                    color: '#dc2626',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    fontSize: '13px',
                    fontWeight: '700'
                  }}>
                    ✗ {saveErrorMsg}
                  </div>
                )}

                <div className={styles.actionFooter}>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleSaveAssessment(false)}
                    className={styles.saveDraftBtn}
                    style={{ opacity: isSubmitting ? 0.6 : 1, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
                  >
                    Save Assessment Draft
                  </button>

                  <div className={styles.primaryActionGroup}>
                    {selectedAssessment.status === 'admin_approved' ? (
                      selectedAssessment.adjustmentCount && selectedAssessment.adjustmentCount >= 3 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            fontSize: '12px',
                            fontWeight: '800',
                            color: '#dc2626',
                            backgroundColor: '#fee2e2',
                            border: '1px solid #fecaca',
                            padding: '8px 14px',
                            borderRadius: '8px'
                          }}>
                            🔒 Reconsideration limit reached (3/3 used). Admin decision is final.
                          </span>
                          <Link
                            href="/officer/borrowers/new"
                            className={styles.proceedContractLink}
                          >
                            Proceed to Step 7 Contract <ChevronRight size={16} />
                          </Link>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <button
                            ref={triggerBtnRef}
                            type="button"
                            disabled={isReconsidering || isSubmitting}
                            onClick={handleOpenReconsiderationModal}
                            style={{
                              backgroundColor: '#f59e0b',
                              color: '#ffffff',
                              border: 'none',
                              padding: '10px 18px',
                              borderRadius: '8px',
                              fontWeight: '800',
                              fontSize: '13px',
                              cursor: (isReconsidering || isSubmitting) ? 'not-allowed' : 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.25)',
                              opacity: (isReconsidering || isSubmitting) ? 0.7 : 1
                            }}
                          >
                            <Sliders size={16} /> Request Reconsideration ({3 - (selectedAssessment.adjustmentCount || 0)} left)
                          </button>

                          <Link
                            href="/officer/borrowers/new"
                            className={styles.proceedContractLink}
                          >
                            Proceed to Step 7 Contract <ChevronRight size={16} />
                          </Link>
                        </div>
                      )
                    ) : selectedAssessment.status === 'pending_admin' ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        backgroundColor: '#e0f2fe',
                        border: '1px solid #bae6fd',
                        color: '#0369a1',
                        padding: '10px 18px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '800'
                      }}>
                        <Building size={16} /> {selectedAssessment.adjustmentCount && selectedAssessment.adjustmentCount > 0 ? `Awaiting Admin Reconsideration (Round ${selectedAssessment.adjustmentCount} of 3)` : 'Endorsed • Awaiting Admin Committee'}
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={isSubmitting || selectedAssessment.status === 'contract_ready' || selectedAssessment.status === 'disbursed'}
                        onClick={() => handleSaveAssessment(true)}
                        className={styles.endorseAdminBtn}
                        style={{ opacity: isSubmitting ? 0.7 : 1, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
                      >
                        <Building size={16} /> {isSubmitting ? 'Endorsing...' : 'Submit & Endorse to Admin'}
                      </button>
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

      {/* Modern In-App Reconsideration Confirmation Modal */}
      {isConfirmModalOpen && selectedAssessment && (
        <div
          className={styles.modalOverlay}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isReconsidering) {
              handleCloseReconsiderationModal();
            }
          }}
        >
          <div
            ref={modalRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reconsideration-modal-title"
            aria-describedby="reconsideration-modal-desc"
            className={styles.modalCard}
          >
            {/* Modal Header */}
            <div className={styles.modalHeader}>
              <div className={styles.modalHeaderLeft}>
                <div className={styles.modalIconWrapper}>
                  <Sliders size={20} />
                </div>
                <div className={styles.modalTitleArea}>
                  <div className={styles.modalTitleRow}>
                    <h3 id="reconsideration-modal-title" className={styles.modalTitle}>
                      Confirm Reconsideration Request
                    </h3>
                    <span className={styles.modalRoundBadge}>
                      Round {Number(selectedAssessment.adjustmentCount || 0) + 1} of 3
                    </span>
                  </div>
                  <p id="reconsideration-modal-desc" className={styles.modalSubtitle}>
                    This will return the loan application to the Admin Credit Committee for decision reconsideration.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseReconsiderationModal}
                disabled={isReconsidering}
                aria-label="Close reconsideration modal"
                className={styles.modalCloseBtn}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className={styles.modalBody}>
              {/* Comparison Row: Admin Approved vs AO Requested */}
              <div className={styles.modalComparisonRow}>
                <div className={styles.modalAmountCard}>
                  <span className={styles.modalAmountLabel}>Current Admin-Approved Amount</span>
                  <div className={styles.modalAmountValApproved}>
                    ₱ {(Number(selectedAssessment.adminApprovedAmount || 0)).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className={styles.modalComparisonArrow}>
                  <ArrowRight size={18} />
                </div>

                <div className={styles.modalAmountCard}>
                  <span className={styles.modalAmountLabel}>AO Requested Amount</span>
                  <div className={styles.modalAmountValRequested}>
                    ₱ {(Number(officerAmount || 0)).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Justification Block */}
              <div className={styles.modalJustificationBox}>
                <span className={styles.modalJustificationLabel}>
                  Officer Endorsement Justification:
                </span>
                <p className={styles.modalJustificationText}>
                  &ldquo;{officerNote.trim()}&rdquo;
                </p>
              </div>

              {/* Warning note */}
              <div className={styles.modalPauseWarning}>
                <AlertCircle size={16} color="#b45309" style={{ flexShrink: 0, marginTop: '2px' }} />
                <p className={styles.modalPauseWarningText}>
                  Note: Contract generation and disbursement processing pauses until Admin decides on this reconsideration request.
                </p>
              </div>

              {/* Error banner inside modal if API fails */}
              {modalErrorMsg && (
                <div className={styles.modalErrorBanner}>
                  ✗ {modalErrorMsg}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className={styles.modalFooter}>
              <button
                type="button"
                disabled={isReconsidering}
                onClick={handleCloseReconsiderationModal}
                className={styles.modalSecondaryBtn}
              >
                Keep Editing
              </button>
              <button
                type="button"
                disabled={isReconsidering}
                onClick={handleConfirmReconsiderationSubmit}
                className={styles.modalPrimaryBtn}
              >
                {isReconsidering ? (
                  <>
                    <div style={{ width: '14px', height: '14px', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    <span>Sending Reconsideration...</span>
                  </>
                ) : (
                  <>
                    <Building size={16} />
                    <span>Send for Reconsideration</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <OfficerMobileNav onOpenSidebar={() => setMobileMenuOpen(true)} />
    </div>
  );
}
