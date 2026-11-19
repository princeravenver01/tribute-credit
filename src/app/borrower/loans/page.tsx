'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  CreditCard, 
  CheckCircle, 
  AlertCircle, 
  FileText, 
  UserCheck, 
  Eye, 
  X, 
  RefreshCw,
  PlusCircle,
  Clock,
  ShieldAlert,
  Calendar
} from 'lucide-react';
import { BorrowerNav } from '@/components/borrower/BorrowerNav';
import { CreditAssessmentItem } from '@/lib/credit-assessment-store';
import { interpolateContractHtml } from '@/lib/contract-template-store';
import styles from './loans.module.css';

interface LoanHealthInfo {
  status: 'Healthy' | 'Due Soon' | 'Overdue' | 'Contract Breach' | 'Fully Paid' | 'Under Review';
  reason?: string;
  daysRemaining?: number;
  daysOverdue?: number;
  breachObligation?: string;
}

interface BorrowerLoansPortalData {
  user?: {
    id: number | string;
    name: string;
    email: string;
    role: string;
    memberNo: string;
  };
  allLoans?: CreditAssessmentItem[];
  reloanEligibility?: {
    eligible: boolean;
    reason?: string;
  };
  coopSettings?: {
    coopName?: string;
    branchName?: string;
  };
}

export default function BorrowerLoansPage() {
  const router = useRouter();
  const [data, setData] = useState<BorrowerLoansPortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'current' | 'completed'>('current');

  // Modals state
  const [selectedLoanForDoc, setSelectedLoanForDoc] = useState<CreditAssessmentItem | null>(null);
  const [docModalType, setDocModalType] = useState<'contract' | 'staff' | 'signatures' | 'schedule' | null>(null);

  // Renewal Modal
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const [renewalAmount, setRenewalAmount] = useState('10000');
  const [renewalProduct, setRenewalProduct] = useState('Regular Loan');
  const [renewalTerm, setRenewalTerm] = useState('3');
  const [renewalPurpose, setRenewalPurpose] = useState('Business Expansion');
  const [renewalSubmitting, setRenewalSubmitting] = useState(false);
  const [renewalMessage, setRenewalMessage] = useState<string | null>(null);
  const [renewalError, setRenewalError] = useState<string | null>(null);

  const loadData = () => {
    fetch('/api/borrower/portal')
      .then(async (res) => {
        if (res.status === 401) {
          router.push('/borrower/login');
          return;
        }
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || 'Failed to load loans');
        setData(json);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Network error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [router]);

  const allLoans: CreditAssessmentItem[] = useMemo(() => data?.allLoans || [], [data?.allLoans]);
  const reloanEligible = data?.reloanEligibility?.eligible ?? false;
  const reloanReason = data?.reloanEligibility?.reason ?? '';

  // Classify loans
  const currentLoans = useMemo(() => {
    return allLoans.filter((l) => l.status !== 'completed' && (l.remainingBalance === undefined || l.remainingBalance > 0));
  }, [allLoans]);

  const completedLoans = useMemo(() => {
    return allLoans.filter((l) => l.status === 'completed' || (l.status === 'disbursed' && l.remainingBalance === 0));
  }, [allLoans]);

  // Compute Real Loan Health
  const calculateLoanHealth = (loan: CreditAssessmentItem): LoanHealthInfo => {
    if (loan.status === 'completed' || (loan.status === 'disbursed' && loan.remainingBalance === 0)) {
      return { status: 'Fully Paid' };
    }
    if (loan.status !== 'disbursed') {
      return { status: 'Under Review', reason: `Status: ${loan.status.replace(/_/g, ' ')}` };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (Array.isArray(loan.paymentLedgerRecords) && loan.paymentLedgerRecords.length > 0) {
      let consecutiveMissed = 0;
      let earliestOverdue: Date | null = null;
      let overdueCount = 0;
      let nextDue: Date | null = null;

      for (const p of loan.paymentLedgerRecords) {
        if (p.status !== 'Paid' && p.status !== 'Fully Paid') {
          const dueDate = new Date(p.paymentSchedule);
          if (!isNaN(dueDate.getTime())) {
            if (dueDate < today) {
              consecutiveMissed++;
              overdueCount++;
              if (!earliestOverdue || dueDate < earliestOverdue) {
                earliestOverdue = dueDate;
              }
            } else {
              if (!nextDue || dueDate < nextDue) nextDue = dueDate;
            }
          }
        } else {
          consecutiveMissed = 0;
        }
      }

      if (earliestOverdue) {
        const diffMs = today.getTime() - earliestOverdue.getTime();
        const daysOverdue = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (consecutiveMissed >= 3 || daysOverdue >= 30) {
          return {
            status: 'Contract Breach',
            daysOverdue,
            breachObligation: `Missed ${overdueCount} installment(s). Default reached from obligation due on ${earliestOverdue.toISOString().split('T')[0]}.`,
          };
        }
        return {
          status: 'Overdue',
          daysOverdue,
          reason: `Payment overdue by ${daysOverdue} days (Due date: ${earliestOverdue.toISOString().split('T')[0]}).`,
        };
      }

      if (nextDue) {
        const diffMs = nextDue.getTime() - today.getTime();
        const daysRemaining = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
        if (daysRemaining <= 3) {
          return {
            status: 'Due Soon',
            daysRemaining,
            reason: `Installment payable in ${daysRemaining} day(s) on ${nextDue.toISOString().split('T')[0]}.`,
          };
        }
        return {
          status: 'Healthy',
          daysRemaining,
          reason: `All past obligations paid. Next scheduled due on ${nextDue.toISOString().split('T')[0]}.`,
        };
      }
    }

    return { status: 'Healthy', reason: 'Account in good standing.' };
  };

  const handleRenewalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRenewalSubmitting(true);
    setRenewalError(null);
    setRenewalMessage(null);

    try {
      const res = await fetch('/api/borrower/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'apply_renewal',
          requestedAmount: renewalAmount,
          productName: renewalProduct,
          termMonths: renewalTerm,
          purpose: renewalPurpose,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to submit renewal');
      setRenewalMessage(json.message);
      setTimeout(() => {
        setShowRenewalModal(false);
        loadData();
      }, 2000);
    } catch (err) {
      setRenewalError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setRenewalSubmitting(false);
    }
  };

  const renderedLoans = activeTab === 'current' ? currentLoans : completedLoans;

  return (
    <div className={styles.shell}>
      <BorrowerNav user={data?.user} coopSettings={data?.coopSettings} />

      <main className={styles.mainContent}>
        <div className={styles.headerSection}>
          <div className={styles.titleArea}>
            <h1>My Loans &amp; Portfolios</h1>
            <p>Track your active loans, health status, contractual obligations, and documents.</p>
          </div>

          <button
            type="button"
            className={styles.reloanBtn}
            disabled={!reloanEligible}
            onClick={() => setShowRenewalModal(true)}
            title={!reloanEligible ? reloanReason : 'Submit an application for loan renewal'}
          >
            <PlusCircle size={16} />
            <span>Renew / Reloan</span>
          </button>
        </div>

        {!reloanEligible && reloanReason && (
          <div className={styles.reloanWarningAlert}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>
              <strong>Reloan Ineligible:</strong> {reloanReason}
            </span>
          </div>
        )}

        {/* TABS: Current vs Completed */}
        <div className={styles.tabRow}>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'current' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('current')}
          >
            <Clock size={16} />
            <span>Active &amp; In-Progress Loans ({currentLoans.length})</span>
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'completed' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('completed')}
          >
            <CheckCircle size={16} />
            <span>Fully Paid / Completed ({completedLoans.length})</span>
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px', color: '#64748B' }}>
            <RefreshCw size={32} className="spin" style={{ margin: '0 auto 12px auto' }} />
            <p>Loading member loans...</p>
          </div>
        ) : error ? (
          <div style={{ padding: '24px', backgroundColor: '#FEF2F2', color: '#991B1B', borderRadius: '10px' }}>
            {error}
          </div>
        ) : renderedLoans.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
            <CreditCard size={40} color="#94A3B8" style={{ margin: '0 auto 12px auto' }} />
            <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 700 }}>
              No {activeTab === 'current' ? 'active or in-progress' : 'completed'} loans found
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748B' }}>
              {activeTab === 'current'
                ? 'You currently have no outstanding loan balances or active loan applications.'
                : 'You have not settled any historical loan cycles yet.'}
            </p>
          </div>
        ) : (
          renderedLoans.map((loan) => {
            const health = calculateLoanHealth(loan);
            const principal = Number(loan.finalContractAmount ?? loan.adminApprovedAmount ?? loan.requestedAmount ?? 0);
            const totalPaid = Number(loan.totalCollected ?? (loan.status === 'completed' ? principal : 0));
            const remainingBalance = Number(loan.remainingBalance ?? (loan.status === 'completed' ? 0 : Math.max(0, principal - totalPaid)));
            const nextDueAmount = loan.paymentLedgerRecords?.find((p) => p.status === 'Pending' || p.status === 'Overdue')?.payment ?? Math.round(principal / (loan.termMonths || 3));
            const nextDueDate = loan.nextDueDate || loan.firstDueDate || loan.paymentLedgerRecords?.find((p) => p.status === 'Pending')?.paymentSchedule || 'Scheduled';

            return (
              <div key={loan.id} className={styles.loanCard}>
                <div className={styles.loanCardHeader}>
                  <div>
                    <h2 className={styles.loanReferenceTitle}>
                      {loan.applicationId || loan.id}
                      <span className={styles.cyclePill}>Cycle #{loan.loanCycle || 1}</span>
                    </h2>
                    <span style={{ fontSize: '13px', color: '#64748B' }}>
                      {loan.productName || 'Regular Loan'} &bull; {loan.termMonths || 3} Months ({loan.paymentMode || 'Weekly'})
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span
                      className={`${styles.healthBadge} ${
                        health.status === 'Healthy'
                          ? styles.healthHealthy
                          : health.status === 'Due Soon'
                          ? styles.healthDueSoon
                          : health.status === 'Overdue'
                          ? styles.healthOverdue
                          : health.status === 'Contract Breach'
                          ? styles.healthBreach
                          : health.status === 'Fully Paid'
                          ? styles.healthCompleted
                          : styles.healthDueSoon
                      }`}
                    >
                      {health.status === 'Contract Breach' ? <ShieldAlert size={14} /> : null}
                      {health.status}
                    </span>
                  </div>
                </div>

                {/* Overdue / Breach Warning Box */}
                {(health.status === 'Overdue' || health.status === 'Contract Breach') && (
                  <div className={styles.warningBox}>
                    <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <strong>
                        {health.status === 'Contract Breach' ? '🚨 Contract Breach Notice:' : '⚠️ Payment Overdue Warning:'}
                      </strong>
                      <p style={{ margin: '4px 0 0 0' }}>
                        {health.breachObligation || health.reason} Please settle promptly to protect your cooperative credit rating and reloan privileges.
                      </p>
                    </div>
                  </div>
                )}

                {/* Metric Summary */}
                <div className={styles.loanMetricsGrid}>
                  <div className={styles.metricBox}>
                    <span className={styles.metricLabel}>Loan Principal</span>
                    <span className={styles.metricValue}>₱ {principal.toLocaleString('en-PH')}</span>
                  </div>
                  <div className={styles.metricBox}>
                    <span className={styles.metricLabel}>Total Paid</span>
                    <span className={styles.metricValue} style={{ color: '#059669' }}>
                      ₱ {totalPaid.toLocaleString('en-PH')}
                    </span>
                  </div>
                  <div className={styles.metricBox}>
                    <span className={styles.metricLabel}>Remaining Balance</span>
                    <span className={styles.metricValue}>
                      ₱ {remainingBalance.toLocaleString('en-PH')}
                    </span>
                  </div>
                  <div className={styles.metricBox}>
                    <span className={styles.metricLabel}>Next Payable Due</span>
                    <span className={styles.metricValue}>
                      {health.status === 'Fully Paid' ? '—' : `₱ ${Number(nextDueAmount).toLocaleString('en-PH')}`}
                    </span>
                    {health.status !== 'Fully Paid' && (
                      <span style={{ fontSize: '11px', color: '#64748B', display: 'block', marginTop: '2px' }}>
                        Due on: {nextDueDate}
                      </span>
                    )}
                  </div>
                </div>

                {/* Document Actions inside Loan */}
                <div className={styles.actionRow}>
                  <button
                    type="button"
                    className={styles.outlineBtn}
                    onClick={() => {
                      setSelectedLoanForDoc(loan);
                      setDocModalType('contract');
                    }}
                  >
                    <FileText size={14} color="#059669" />
                    <span>View Executed Contract</span>
                  </button>

                  <button
                    type="button"
                    className={styles.outlineBtn}
                    onClick={() => {
                      setSelectedLoanForDoc(loan);
                      setDocModalType('staff');
                    }}
                  >
                    <UserCheck size={14} color="#2563EB" />
                    <span>Staff Information Sheet</span>
                  </button>

                  <button
                    type="button"
                    className={styles.outlineBtn}
                    onClick={() => {
                      setSelectedLoanForDoc(loan);
                      setDocModalType('signatures');
                    }}
                  >
                    <Eye size={14} color="#7C3AED" />
                    <span>Specimen Signatures &amp; Photos</span>
                  </button>

                  <button
                    type="button"
                    className={styles.outlineBtn}
                    onClick={() => {
                      setSelectedLoanForDoc(loan);
                      setDocModalType('schedule');
                    }}
                  >
                    <Calendar size={14} color="#D97706" />
                    <span>Repayment Ledger ({loan.paymentLedgerRecords?.length || 0})</span>
                  </button>
                </div>
              </div>
            );
          })
        )}

        {/* MODAL: DOCUMENT & EVIDENCE VIEWER */}
        {selectedLoanForDoc && docModalType && (
          <div className={styles.modalBackdrop} onClick={() => setDocModalType(null)}>
            <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>
                  {docModalType === 'contract' && 'Official Executed Contract Snapshot'}
                  {docModalType === 'staff' && 'Account Officer & Staff Information Sheet'}
                  {docModalType === 'signatures' && 'Borrower Specimen Signatures & Identity Photos'}
                  {docModalType === 'schedule' && 'Amortization & Repayment Ledger'}
                </h3>
                <button type="button" className={styles.closeBtn} onClick={() => setDocModalType(null)}>
                  <X size={20} />
                </button>
              </div>

              <div className={styles.modalBody}>
                {docModalType === 'contract' && (
                  <div>
                    {selectedLoanForDoc.contractTemplateSnapshot ? (
                      <div
                        dangerouslySetInnerHTML={{
                          __html: interpolateContractHtml(
                            [
                              selectedLoanForDoc.contractTemplateSnapshot.sections.promissoryHtml,
                              selectedLoanForDoc.contractTemplateSnapshot.sections.defaultHtml,
                              selectedLoanForDoc.contractTemplateSnapshot.sections.privacyHtml,
                              selectedLoanForDoc.contractTemplateSnapshot.sections.additionalClausesHtml || '',
                            ].join('<hr style="margin: 20px 0; border: none; border-top: 1px dashed #cbd5e1;" />'),
                            {
                              borrowerName: selectedLoanForDoc.borrowerName,
                              principal: `₱ ${Number(selectedLoanForDoc.finalContractAmount ?? selectedLoanForDoc.adminApprovedAmount ?? 10000).toLocaleString('en-PH')}`,
                              installmentAmount: `₱ ${Math.round(Number(selectedLoanForDoc.finalContractAmount ?? 10000) / 12).toLocaleString('en-PH')}`,
                              repaymentFrequency: selectedLoanForDoc.paymentMode || 'Weekly',
                              termMonths: selectedLoanForDoc.termMonths || 3,
                              policyNo: selectedLoanForDoc.policyNo || selectedLoanForDoc.mcid,
                            }
                          ),
                        }}
                      />
                    ) : (
                      <p style={{ textAlign: 'center', color: '#64748B', padding: '32px' }}>
                        Executed contract snapshot not available on this historical record.
                      </p>
                    )}
                  </div>
                )}

                {docModalType === 'staff' && (
                  <div>
                    <div style={{ backgroundColor: '#F8FAFC', padding: '16px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                      <p style={{ margin: '0 0 8px 0', fontSize: '13px' }}>
                        <strong>Evaluating Officer:</strong> {selectedLoanForDoc.evaluatedByOfficer || 'Officer Juan (AO-001)'}
                      </p>
                      <p style={{ margin: '0 0 8px 0', fontSize: '13px' }}>
                        <strong>Evaluation Date:</strong> {selectedLoanForDoc.evaluatedAt || '—'}
                      </p>
                      <p style={{ margin: '0 0 8px 0', fontSize: '13px' }}>
                        <strong>AO Recommendation:</strong> {selectedLoanForDoc.officerRecommendation?.replace(/_/g, ' ') || 'Approved'}
                      </p>
                      <p style={{ margin: '0', fontSize: '13px' }}>
                        <strong>Branch Verification:</strong> {data?.coopSettings?.branchName || 'Main Operations'}
                      </p>
                    </div>
                  </div>
                )}

                {docModalType === 'signatures' && (
                  <div>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 700 }}>Borrower Specimen Signatures</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '24px' }}>
                      {[0, 1, 2].map((idx) => {
                        const sigObj = selectedLoanForDoc.borrowerSignatures && selectedLoanForDoc.borrowerSignatures[idx];
                        const sigUrl = sigObj?.signature || (idx === 0 ? selectedLoanForDoc.applicantSignature : undefined);
                        return (
                          <div key={idx} style={{ border: '1px solid #CBD5E1', borderRadius: '8px', padding: '10px', textAlign: 'center', backgroundColor: '#F8FAFC' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', display: 'block' }}>Specimen #{idx + 1}</span>
                            {sigUrl ? (
                              <img src={sigUrl} alt={`Specimen ${idx + 1}`} style={{ maxHeight: '40px', maxWidth: '100%', margin: '8px auto' }} />
                            ) : (
                              <span style={{ fontSize: '12px', color: '#94A3B8', display: 'block', padding: '12px 0' }}>None</span>
                            )}
                            <span style={{ fontSize: '10px', color: '#64748B', display: 'block' }}>{sigObj?.authId || 'Verified Record'}</span>
                          </div>
                        );
                      })}
                    </div>

                    <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 700 }}>Identity Verification Photos</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
                      <div style={{ border: '1px solid #CBD5E1', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: '8px' }}>Borrower Live Face Photo</span>
                        {selectedLoanForDoc.applicantFacePhoto ? (
                          <img src={selectedLoanForDoc.applicantFacePhoto} alt="Borrower Face" style={{ maxHeight: '140px', borderRadius: '6px' }} />
                        ) : (
                          <p style={{ color: '#94A3B8', fontSize: '12px', padding: '24px 0' }}>Photo not captured</p>
                        )}
                      </div>
                      <div style={{ border: '1px solid #CBD5E1', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: '8px' }}>Borrower Holding Valid ID</span>
                        {selectedLoanForDoc.borrowerHoldingIdPhoto ? (
                          <img src={selectedLoanForDoc.borrowerHoldingIdPhoto} alt="Holding ID" style={{ maxHeight: '140px', borderRadius: '6px' }} />
                        ) : (
                          <p style={{ color: '#94A3B8', fontSize: '12px', padding: '24px 0' }}>Photo not captured</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {docModalType === 'schedule' && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #CBD5E1' }}>
                          <th style={{ padding: '8px', textAlign: 'left' }}>#</th>
                          <th style={{ padding: '8px', textAlign: 'left' }}>Due Date</th>
                          <th style={{ padding: '8px', textAlign: 'left' }}>Status</th>
                          <th style={{ padding: '8px', textAlign: 'left' }}>Date Paid</th>
                          <th style={{ padding: '8px', textAlign: 'right' }}>Amount</th>
                          <th style={{ padding: '8px', textAlign: 'right' }}>Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(!selectedLoanForDoc.paymentLedgerRecords || selectedLoanForDoc.paymentLedgerRecords.length === 0) ? (
                          <tr>
                            <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: '#64748B' }}>
                              Repayment ledger begins upon official loan disbursement.
                            </td>
                          </tr>
                        ) : (
                          selectedLoanForDoc.paymentLedgerRecords.map((r, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                              <td style={{ padding: '8px', fontWeight: 700 }}>#{r.installmentNo || i + 1}</td>
                              <td style={{ padding: '8px' }}>{r.paymentSchedule}</td>
                              <td style={{ padding: '8px', fontWeight: 700, color: r.status === 'Paid' ? '#059669' : r.status === 'Overdue' ? '#DC2626' : '#D97706' }}>
                                {r.status}
                              </td>
                              <td style={{ padding: '8px' }}>{r.datePaid || '—'}</td>
                              <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700 }}>₱ {Number(r.payment || 0).toLocaleString('en-PH')}</td>
                              <td style={{ padding: '8px', textAlign: 'right' }}>₱ {Number(r.loanBalance || 0).toLocaleString('en-PH')}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MODAL: RELOAN / RENEWAL CONFIRMATION */}
        {showRenewalModal && (
          <div className={styles.modalBackdrop} onClick={() => setShowRenewalModal(false)}>
            <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>Request Loan Renewal (Reloan)</h3>
                <button type="button" className={styles.closeBtn} onClick={() => setShowRenewalModal(false)}>
                  <X size={20} />
                </button>
              </div>

              <div className={styles.modalBody}>
                <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748B' }}>
                  Your previous loan cycle obligations have been settled. Submit this request for review by your assigned Account Officer and Credit Committee.
                </p>

                {renewalMessage && (
                  <div style={{ padding: '12px', backgroundColor: '#ECFDF5', color: '#065F46', borderRadius: '8px', marginBottom: '16px', fontWeight: 700 }}>
                    {renewalMessage}
                  </div>
                )}

                {renewalError && (
                  <div style={{ padding: '12px', backgroundColor: '#FEF2F2', color: '#991B1B', borderRadius: '8px', marginBottom: '16px' }}>
                    {renewalError}
                  </div>
                )}

                <form onSubmit={handleRenewalSubmit}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Loan Product</label>
                    <select
                      className={styles.formSelect}
                      value={renewalProduct}
                      onChange={(e) => setRenewalProduct(e.target.value)}
                    >
                      <option value="Regular Loan">Regular Loan</option>
                      <option value="Small Business Loan">Small Business Loan</option>
                      <option value="Emergency Loan">Emergency Loan</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Requested Principal (₱)</label>
                    <input
                      type="number"
                      step="1000"
                      min="5000"
                      max="50000"
                      className={styles.formInput}
                      value={renewalAmount}
                      onChange={(e) => setRenewalAmount(e.target.value)}
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Term (Months)</label>
                    <select
                      className={styles.formSelect}
                      value={renewalTerm}
                      onChange={(e) => setRenewalTerm(e.target.value)}
                    >
                      <option value="2">2 Months</option>
                      <option value="3">3 Months</option>
                      <option value="4">4 Months</option>
                      <option value="5">5 Months</option>
                      <option value="6">6 Months</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Purpose of Renewal</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      value={renewalPurpose}
                      onChange={(e) => setRenewalPurpose(e.target.value)}
                      required
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                    <button
                      type="button"
                      className={styles.outlineBtn}
                      onClick={() => setShowRenewalModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className={styles.reloanBtn}
                      disabled={renewalSubmitting}
                    >
                      {renewalSubmitting ? 'Submitting Application...' : 'Confirm & Submit Renewal'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
