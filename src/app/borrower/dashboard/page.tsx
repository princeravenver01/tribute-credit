'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  CreditCard, 
  Calendar, 
  CheckCircle, 
  Clock, 
  PlusCircle, 
  FileText, 
  BookOpen, 
  Printer, 
  User, 
  LogOut, 
  AlertCircle, 
  RefreshCw, 
  Eye, 
  Coins, 
  Home, 
  FileCheck2, 
  X
} from 'lucide-react';
import { PassbookBooklet, LoanPaymentLedger, type PassbookData } from '@/components/passbook/PassbookBooklet';
import { interpolateContractHtml } from '@/lib/contract-template-store';
import { calculateTributeLoan } from '@/lib/tribute-loan-engine';
import { CreditAssessmentItem } from '@/lib/credit-assessment-store';
import styles from './dashboard.module.css';

type DashboardTab = 'home' | 'loan' | 'payments' | 'cbu' | 'documents' | 'profile';

interface BorrowerPortalUser {
  id: string | number;
  name: string;
  email: string;
  role: string;
  memberNo: string;
}

interface BorrowerPortalResponse {
  success: boolean;
  user: BorrowerPortalUser;
  activeLoan: CreditAssessmentItem | null;
  historyLoans: CreditAssessmentItem[];
  totalLoansCount: number;
  coopSettings: Record<string, unknown> | null;
}

export default function BorrowerDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<DashboardTab>('home');
  const [data, setData] = useState<BorrowerPortalResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showContractModal, setShowContractModal] = useState(false);
  const [showPassbookModal, setShowPassbookModal] = useState(false);
  const [passbookSubTab, setPassbookSubTab] = useState<'booklet' | 'ledger'>('booklet');

  // Profile forms
  const [contactNumber, setContactNumber] = useState('');
  const [address, setAddress] = useState('');
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Password change form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSubmitting, setPwSubmitting] = useState(false);

  const fetchPortalData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/borrower/portal');
      if (res.status === 401) {
        router.push('/borrower/login');
        return;
      }
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to retrieve member account information');
      }
      setData(json);
      if (json.user) {
        setContactNumber(json.activeLoan?.contactNumber || '');
        setAddress(json.activeLoan?.location || '');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

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
          throw new Error(json.error || 'Failed to retrieve member account');
        }
        setData(json);
        if (json.activeLoan) {
          setContactNumber(json.activeLoan.contactNumber || '');
          setAddress(json.activeLoan.location || '');
        }
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [router]);

  const activeLoan = data?.activeLoan || null;
  const user = data?.user || null;
  const coopSettings = data?.coopSettings || null;

  // Canonical calculations
  const loanCalc = useMemo(() => {
    if (!activeLoan) return null;
    const principal = Number(activeLoan.finalContractAmount ?? activeLoan.adminApprovedAmount ?? activeLoan.officerAdjustedAmount ?? 10000);
    const term = Number(activeLoan.termMonths) || 3;
    const prod = activeLoan.productName || 'Regular Loan';
    const freq = (activeLoan.paymentMode as 'Daily' | 'Weekly' | 'Semi-Monthly' | 'Monthly') || 'Weekly';
    return calculateTributeLoan(principal, term, prod, freq);
  }, [activeLoan]);

  // Passbook data mapping
  const passbookData: PassbookData | null = useMemo(() => {
    if (!activeLoan || !user) return null;
    const principal = Number(activeLoan.finalContractAmount ?? activeLoan.adminApprovedAmount ?? 10000);
    const termMonths = Number(activeLoan.termMonths) || 3;
    const paymentMode = activeLoan.paymentMode || 'Weekly';
    const releaseDate = activeLoan.disbursedAt || activeLoan.contractExecutedAt || 'Pending release';

    const borrowerSigs = Array.isArray(activeLoan.borrowerSignatures)
      ? activeLoan.borrowerSignatures
      : [];

    const cbuRows = Array.isArray(activeLoan.savingsLedgerRecords)
      ? activeLoan.savingsLedgerRecords.map((r) => ({
          paymentSchedule: r.date || 'Regular Contribution',
          datePaid: r.date,
          cbuIn: r.type === 'deposit' ? r.amount : 0,
          cbuOut: r.type === 'withdraw' ? r.amount : 0,
          cbuBalance: r.runningBalance,
          aoSignature: r.processedBy,
          aoSignatureImage: r.aoSignatureImage,
        }))
      : [];

    return {
      borrowerName: activeLoan.borrowerName || user.name,
      cidNumber: activeLoan.mcid || activeLoan.policyNo || user.memberNo,
      loanReference: activeLoan.applicationId || activeLoan.id,
      mcidNumber: activeLoan.mcid || user.memberNo,
      permanentAddress: activeLoan.location || 'Metro Manila',
      membershipDate: activeLoan.membershipDate || releaseDate,
      dateIssued: releaseDate,
      loanType: (activeLoan.productName || 'Regular Loan').replace(' Loan', ''),
      loanAmount: principal,
      termMonths,
      paymentMode,
      cycle: activeLoan.loanCycle || 1,
      cbuInitialDeposit: loanCalc?.cbuAmount || 500,
      cbuBalance: activeLoan.savingsBalance ?? loanCalc?.cbuAmount ?? 500,
      specimenSignature: activeLoan.applicantSignature || borrowerSigs[0]?.signature,
      specimenSignatures: borrowerSigs,
      aoSignatures: activeLoan.officerSignatures,
      adminSignatures: activeLoan.adminSignatures,
      adminActionAt: activeLoan.adminActionAt,
      paymentRecords: activeLoan.paymentLedgerRecords || [],
      cbuRecords: cbuRows,
    };
  }, [activeLoan, user, loanCalc]);

  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    router.push('/borrower/login');
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSuccess(null);
    setProfileError(null);
    try {
      const res = await fetch('/api/borrower/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_profile', contactNumber, address }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to update details');
      setProfileSuccess('Contact information successfully updated.');
      setTimeout(() => setProfileSuccess(null), 3000);
    } catch (err: unknown) {
      setProfileError(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwSuccess(null);
    setPwError(null);
    setPwSubmitting(true);
    try {
      const res = await fetch('/api/borrower/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change_password',
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to change password');
      setPwSuccess('Your password has been securely updated.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPwSuccess(null), 3000);
    } catch (err: unknown) {
      setPwError(err instanceof Error ? err.message : 'Password update failed');
    } finally {
      setPwSubmitting(false);
    }
  };

  return (
    <div className={styles.portalShell}>
      <main className={styles.portalMain}>
        {/* MEMBER HEADER & IDENTITY */}
        <header className={styles.headerCard}>
          <div className={styles.headerTop}>
            <div>
              <p className={styles.greetingText}>
                {String(coopSettings?.coopName || 'TRIBUTE CREDIT COOPERATIVE')} &bull; MEMBER PORTAL
              </p>
              <h1 className={styles.memberName}>{user?.name || 'Valued Member'}</h1>
              <div className={styles.memberMeta}>
                <span className={styles.mcidBadge}>MCID: {user?.memberNo || 'TCID-A-00001'}</span>
                <span>Branch: {String(coopSettings?.branchName || 'Main Operations')}</span>
                <span>Account Status: Active Member</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Link
                href="/borrower/apply"
                className={styles.actionBtnGreen}
                style={{ backgroundColor: '#ffffff', color: '#064e3b', fontWeight: '800' }}
              >
                <PlusCircle size={15} /> Apply New Loan
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className={styles.signOutBtn}
                title="Log out of member portal"
              >
                <LogOut size={14} /> Sign Out
              </button>
            </div>
          </div>
        </header>

        {/* DESKTOP TAB NAVIGATION */}
        <nav className={styles.tabNav}>
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className={`${styles.tabBtn} ${activeTab === 'home' ? styles.tabBtnActive : ''}`}
          >
            <Home size={15} /> Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('loan')}
            className={`${styles.tabBtn} ${activeTab === 'loan' ? styles.tabBtnActive : ''}`}
          >
            <CreditCard size={15} /> Active Facility
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('payments')}
            className={`${styles.tabBtn} ${activeTab === 'payments' ? styles.tabBtnActive : ''}`}
          >
            <Calendar size={15} /> Payment Ledger
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cbu')}
            className={`${styles.tabBtn} ${activeTab === 'cbu' ? styles.tabBtnActive : ''}`}
          >
            <Coins size={15} /> CBU &amp; Savings
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('documents')}
            className={`${styles.tabBtn} ${activeTab === 'documents' ? styles.tabBtnActive : ''}`}
          >
            <BookOpen size={15} /> Passbook &amp; Contract
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`${styles.tabBtn} ${activeTab === 'profile' ? styles.tabBtnActive : ''}`}
          >
            <User size={15} /> My Account
          </button>
        </nav>

        {/* LOADING & ERROR STATES */}
        {loading && (
          <div className={styles.emptyCard}>
            <RefreshCw size={28} color="#059669" className="animate-spin" style={{ margin: '0 auto 12px auto' }} />
            <h3 className={styles.emptyTitle}>Accessing Member Loan Records...</h3>
            <p className={styles.emptyText}>Synchronizing authenticated financial ledgers and contract snapshots.</p>
          </div>
        )}

        {!loading && error && (
          <div className={styles.emptyCard} style={{ borderColor: '#FECACA' }}>
            <AlertCircle size={28} color="#DC2626" style={{ margin: '0 auto 12px auto' }} />
            <h3 className={styles.emptyTitle} style={{ color: '#DC2626' }}>Account Access Notice</h3>
            <p className={styles.emptyText}>{error}</p>
            <button type="button" onClick={fetchPortalData} className={styles.actionBtnGreen}>
              Retry Connection
            </button>
          </div>
        )}

        {/* NO LOAN STATE */}
        {!loading && !error && !activeLoan && (
          <div className={styles.emptyCard}>
            <CreditCard size={36} color="#059669" style={{ margin: '0 auto 14px auto' }} />
            <h3 className={styles.emptyTitle}>No Active Loan Application</h3>
            <p className={styles.emptyText}>
              You currently have no pending or active microfinance credit facilities with Tribute Credit Cooperative.
            </p>
            <Link href="/borrower/apply" className={styles.actionBtnGreen}>
              <PlusCircle size={15} /> Submit Loan Application
            </Link>
          </div>
        )}

        {/* TAB 1: OVERVIEW / TIMELINE */}
        {!loading && !error && activeLoan && (activeTab === 'home' || activeTab === 'loan') && (
          <>
            {/* CANONICAL STATUS & TIMELINE */}
            <div className={styles.timelineCard}>
              <h3 className={styles.timelineTitle}>
                <Clock size={16} color="#059669" /> Application &amp; Disbursement Progression
              </h3>

              <div className={styles.timelineTrack}>
                <div className={styles.timelineStep}>
                  <div className={`${styles.timelineDot} ${styles.dotCompleted}`}>1</div>
                  <span className={styles.timelineLabel}>Intake &amp; Assessment</span>
                </div>
                <div className={styles.timelineStep}>
                  <div className={`${styles.timelineDot} ${activeLoan.status !== 'pending_assessment' ? styles.dotCompleted : styles.dotActive}`}>2</div>
                  <span className={styles.timelineLabel}>Committee Review</span>
                </div>
                <div className={styles.timelineStep}>
                  <div className={`${styles.timelineDot} ${['contract_ready', 'pending_ao_disbursement', 'disbursed'].includes(activeLoan.status) ? styles.dotCompleted : activeLoan.status === 'admin_approved' ? styles.dotActive : styles.dotPending}`}>3</div>
                  <span className={styles.timelineLabel}>Contract Signing</span>
                </div>
                <div className={styles.timelineStep}>
                  <div className={`${styles.timelineDot} ${['pending_ao_disbursement', 'disbursed'].includes(activeLoan.status) ? styles.dotCompleted : activeLoan.status === 'contract_ready' ? styles.dotActive : styles.dotPending}`}>4</div>
                  <span className={styles.timelineLabel}>Admin Release</span>
                </div>
                <div className={styles.timelineStep}>
                  <div className={`${styles.timelineDot} ${activeLoan.status === 'disbursed' ? styles.dotCompleted : activeLoan.status === 'pending_ao_disbursement' ? styles.dotActive : styles.dotPending}`}>5</div>
                  <span className={styles.timelineLabel}>AO Handover</span>
                </div>
                <div className={styles.timelineStep}>
                  <div className={`${styles.timelineDot} ${activeLoan.status === 'disbursed' ? styles.dotActive : styles.dotPending}`}>6</div>
                  <span className={styles.timelineLabel}>Active Repayment</span>
                </div>
              </div>
            </div>

            {/* STATUS ALERT NOTICES */}
            {activeLoan.status === 'pending_ao_disbursement' && (
              <div className={`${styles.statusAlert} ${styles.statusAlertPendingAo}`}>
                <AlertCircle size={20} color="#D97706" style={{ flexShrink: 0 }} />
                <div>
                  <strong>Funds Released by Admin — Awaiting AO Handover Confirmation:</strong>
                  <p style={{ margin: '2px 0 0 0' }}>
                    Your loan proceeds have been authorized by the Credit Committee. Repayment schedule and ledger will commence immediately after your Account Officer completes the fund handover.
                  </p>
                </div>
              </div>
            )}

            {activeLoan.status === 'contract_ready' && (
              <div className={`${styles.statusAlert} ${styles.statusAlertReview}`}>
                <Clock size={20} color="#2563EB" style={{ flexShrink: 0 }} />
                <div>
                  <strong>Contract Executed — In Queue for Fund Release:</strong>
                  <p style={{ margin: '2px 0 0 0' }}>
                    Your e-signed promissory note is queued for Admin Disbursement release authorization.
                  </p>
                </div>
              </div>
            )}

            {activeLoan.status === 'disbursed' && (
              <div className={`${styles.statusAlert} ${styles.statusAlertDisbursed}`}>
                <CheckCircle size={20} color="#059669" style={{ flexShrink: 0 }} />
                <div>
                  <strong>Facility Disbursed &amp; In Active Repayment:</strong>
                  <p style={{ margin: '2px 0 0 0' }}>
                    Your facility is active. Please adhere to your scheduled {activeLoan.paymentMode || 'Weekly'} amortizations to maintain your credit rating.
                  </p>
                </div>
              </div>
            )}

            {/* KPI METRIC CARDS */}
            <div className={styles.kpiGrid}>
              <div className={styles.kpiCard}>
                <span className={styles.kpiLabel}>Approved Principal</span>
                <span className={styles.kpiValue}>
                  ₱ {Number(activeLoan.finalContractAmount ?? activeLoan.adminApprovedAmount ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className={styles.kpiCard}>
                <span className={styles.kpiLabel}>Net Cash Proceeds</span>
                <span className={`${styles.kpiValue} ${styles.kpiValueAccent}`}>
                  ₱ {loanCalc?.netCashProceeds ? loanCalc.netCashProceeds.toLocaleString('en-PH', { minimumFractionDigits: 2 }) : '0.00'}
                </span>
              </div>
              <div className={styles.kpiCard}>
                <span className={styles.kpiLabel}>Remaining Balance</span>
                <span className={styles.kpiValue}>
                  {activeLoan.status === 'disbursed'
                    ? `₱ ${Number(activeLoan.remainingBalance ?? loanCalc?.contractualBalance ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
                    : 'Repayment begins after release'}
                </span>
              </div>
              <div className={styles.kpiCard}>
                <span className={styles.kpiLabel}>Next Installment Due</span>
                <span className={styles.kpiValue}>
                  {activeLoan.status === 'disbursed'
                    ? (activeLoan.nextDueDate || activeLoan.firstDueDate || 'Scheduled')
                    : 'Awaiting disbursement'}
                </span>
              </div>
            </div>

            {/* ACTIVE LOAN SPECIFICATIONS */}
            <div className={styles.sectionCard}>
              <h3 className={styles.sectionTitle}>Credit Facility Terms &amp; Parameters</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', fontSize: '12.5px' }}>
                <div>
                  <span style={{ color: '#64748B', display: 'block' }}>Loan Product:</span>
                  <strong style={{ color: '#0F172A' }}>{activeLoan.productName || 'Regular Loan'}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748B', display: 'block' }}>Repayment Mode:</span>
                  <strong style={{ color: '#0F172A' }}>{activeLoan.paymentMode || 'Weekly Collection'}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748B', display: 'block' }}>Tenure:</span>
                  <strong style={{ color: '#0F172A' }}>{activeLoan.termMonths || 3} Months</strong>
                </div>
                <div>
                  <span style={{ color: '#64748B', display: 'block' }}>Scheduled Installment:</span>
                  <strong style={{ color: '#059669' }}>₱ {loanCalc?.installmentPerFrequency ? loanCalc.installmentPerFrequency.toLocaleString('en-PH', { minimumFractionDigits: 2 }) : '0.00'}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748B', display: 'block' }}>Disbursement Channel:</span>
                  <strong style={{ color: '#0F172A' }}>{activeLoan.disbursementChannel || 'Cashier Counter'}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748B', display: 'block' }}>Assigned Account Officer:</span>
                  <strong style={{ color: '#0F172A' }}>{activeLoan.evaluatedByOfficer || 'Officer Juan (AO-001)'}</strong>
                </div>
              </div>
            </div>
          </>
        )}

        {/* TAB 2: REPAYMENT SCHEDULE & LEDGER */}
        {!loading && !error && activeLoan && activeTab === 'payments' && (
          <div className={styles.sectionCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <h3 className={styles.sectionTitle} style={{ margin: 0 }}>
                Amortization Schedule &amp; Collections Ledger
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowPassbookModal(true);
                  setPassbookSubTab('ledger');
                }}
                className={styles.actionBtnOutline}
              >
                <Printer size={14} /> Print Official Ledger
              </button>
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Due Schedule</th>
                    <th>Status</th>
                    <th>Date Settled</th>
                    <th>Principal Due</th>
                    <th>Installment Amount</th>
                    <th>Remaining Balance</th>
                    <th>Official Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {(!activeLoan.paymentLedgerRecords || activeLoan.paymentLedgerRecords.length === 0) ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                        {activeLoan.status === 'disbursed'
                          ? 'Ledger initialized. Payments will record upon collection.'
                          : 'Repayment schedule activates after official fund release.'}
                      </td>
                    </tr>
                  ) : (
                    activeLoan.paymentLedgerRecords.map((rec: Record<string, unknown>, idx: number) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: '700' }}>#{String(rec.installmentNo || idx + 1)}</td>
                        <td>{String(rec.paymentSchedule || '')}</td>
                        <td>
                          {rec.status === 'Paid' || rec.status === 'Fully Paid' ? (
                            <span className={styles.statusBadgePaid}>Paid</span>
                          ) : rec.status === 'Overdue' ? (
                            <span className={styles.statusBadgeOverdue}>Overdue</span>
                          ) : (
                            <span className={styles.statusBadgePending}>Pending</span>
                          )}
                        </td>
                        <td>{String(rec.datePaid || '—')}</td>
                        <td>₱ {Number(rec.principalAmount || 0).toLocaleString('en-PH')}</td>
                        <td style={{ fontWeight: '800', color: '#059669' }}>
                          ₱ {Number(rec.payment || 0).toLocaleString('en-PH')}
                        </td>
                        <td>₱ {Number(rec.loanBalance || 0).toLocaleString('en-PH')}</td>
                        <td>
                          {rec.status === 'Paid' ? (
                            <span style={{ fontSize: '11px', color: '#059669', fontWeight: '700' }}>
                              ✓ Verified
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>Pending</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: CBU / SAVINGS */}
        {!loading && !error && activeLoan && activeTab === 'cbu' && (
          <div className={styles.sectionCard}>
            <h3 className={styles.sectionTitle}>Capital Build-Up (CBU) &amp; Member Equity Ledger</h3>
            <p style={{ fontSize: '12px', color: '#64748B', margin: '0 0 16px 0' }}>
              Your Capital Build-Up represents your accumulated co-ownership equity in Tribute Credit Cooperative.
            </p>

            <div className={styles.kpiGrid}>
              <div className={styles.kpiCard}>
                <span className={styles.kpiLabel}>Current CBU Equity</span>
                <span className={`${styles.kpiValue} ${styles.kpiValueAccent}`}>
                  ₱ {Number(activeLoan.savingsBalance ?? loanCalc?.cbuAmount ?? 500).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className={styles.kpiCard}>
                <span className={styles.kpiLabel}>Required Equity Deposit</span>
                <span className={styles.kpiValue}>
                  ₱ {Number(loanCalc?.cbuAmount || 500).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Transaction Type</th>
                    <th>Deposit (In)</th>
                    <th>Withdrawal (Out)</th>
                    <th>Running Balance</th>
                    <th>Receipt Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {(!activeLoan.savingsLedgerRecords || activeLoan.savingsLedgerRecords.length === 0) ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>
                        Initial CBU deposit recorded upon loan release. No subsequent ledger entries recorded yet.
                      </td>
                    </tr>
                  ) : (
                    activeLoan.savingsLedgerRecords.map((s: Record<string, unknown>, idx: number) => (
                      <tr key={idx}>
                        <td>{String(s.date || s.paymentSchedule || '')}</td>
                        <td style={{ fontWeight: '700' }}>{s.type === 'deposit' ? 'Capital Contribution' : 'Adjustment'}</td>
                        <td style={{ color: '#16a34a', fontWeight: '800' }}>₱ {Number(s.cbuIn || s.amount || 0).toLocaleString('en-PH')}</td>
                        <td>₱ {Number(s.cbuOut || 0).toLocaleString('en-PH')}</td>
                        <td style={{ fontWeight: '800' }}>₱ {Number(s.cbuBalance || s.runningBalance || 0).toLocaleString('en-PH')}</td>
                        <td style={{ fontFamily: 'monospace' }}>{String(s.referenceNo || 'CBU-REC')}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: DOCUMENTS & PASSBOOK */}
        {!loading && !error && activeLoan && activeTab === 'documents' && (
          <div className={styles.sectionCard}>
            <h3 className={styles.sectionTitle}>Official Member Documents &amp; Legal Contracts</h3>
            <p style={{ fontSize: '12px', color: '#64748B', margin: '0 0 16px 0' }}>
              Access, inspect, and print your legally executed tripartite promissory notes and official passbook.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
              <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px', backgroundColor: '#FFFFFF' }}>
                <BookOpen size={24} color="#059669" style={{ marginBottom: '10px' }} />
                <h4 style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', margin: '0 0 4px 0' }}>
                  Official Passbook Booklet
                </h4>
                <p style={{ fontSize: '11.5px', color: '#64748B', margin: '0 0 14px 0' }}>
                  Complete member identity booklet with verified specimen signatures and authorization blocks.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowPassbookModal(true);
                    setPassbookSubTab('booklet');
                  }}
                  className={styles.actionBtnGreen}
                >
                  <Eye size={14} /> Open Passbook
                </button>
              </div>

              <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px', backgroundColor: '#FFFFFF' }}>
                <FileCheck2 size={24} color="#059669" style={{ marginBottom: '10px' }} />
                <h4 style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', margin: '0 0 4px 0' }}>
                  E-Signed Executed Contract Snapshot
                </h4>
                <p style={{ fontSize: '11.5px', color: '#64748B', margin: '0 0 14px 0' }}>
                  Immutable legal facility agreement stamped with borrower, AO, and Credit Committee signatures.
                </p>
                <button
                  type="button"
                  onClick={() => setShowContractModal(true)}
                  className={styles.actionBtnGreen}
                >
                  <FileText size={14} /> View Contract Snapshot
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: PROFILE & ACCOUNT */}
        {!loading && !error && activeTab === 'profile' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className={styles.sectionCard}>
              <h3 className={styles.sectionTitle}>Member Contact &amp; Residential Information</h3>
              {profileSuccess && <div className={styles.statusBadgePaid} style={{ marginBottom: '12px', display: 'inline-block' }}>{profileSuccess}</div>}
              {profileError && <div className={styles.statusBadgeOverdue} style={{ marginBottom: '12px', display: 'inline-block' }}>{profileError}</div>}

              <form onSubmit={handleProfileSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', display: 'block', marginBottom: '4px' }}>FULL NAME</label>
                    <input type="text" disabled value={user?.name || ''} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f1f5f9', fontSize: '13px' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', display: 'block', marginBottom: '4px' }}>MEMBER / MCID NUMBER</label>
                    <input type="text" disabled value={user?.memberNo || ''} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f1f5f9', fontSize: '13px', fontFamily: 'monospace' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', display: 'block', marginBottom: '4px' }}>REGISTERED EMAIL</label>
                    <input type="email" disabled value={user?.email || ''} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f1f5f9', fontSize: '13px' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', display: 'block', marginBottom: '4px' }}>CONTACT PHONE</label>
                    <input type="text" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', display: 'block', marginBottom: '4px' }}>RESIDENTIAL ADDRESS</label>
                    <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                  </div>
                </div>
                <button type="submit" className={styles.actionBtnGreen}>Save Contact Details</button>
              </form>
            </div>

            <div className={styles.sectionCard}>
              <h3 className={styles.sectionTitle}>Security &amp; Account Password</h3>
              {pwSuccess && <div className={styles.statusBadgePaid} style={{ marginBottom: '12px', display: 'inline-block' }}>{pwSuccess}</div>}
              {pwError && <div className={styles.statusBadgeOverdue} style={{ marginBottom: '12px', display: 'inline-block' }}>{pwError}</div>}

              <form onSubmit={handlePasswordSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', display: 'block', marginBottom: '4px' }}>CURRENT PASSWORD</label>
                    <input type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', display: 'block', marginBottom: '4px' }}>NEW PASSWORD (MIN. 8 CHARS)</label>
                    <input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', display: 'block', marginBottom: '4px' }}>CONFIRM NEW PASSWORD</label>
                    <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                  </div>
                </div>
                <button type="submit" disabled={pwSubmitting} className={styles.actionBtnGreen}>
                  {pwSubmitting ? 'Updating Password...' : 'Update Password'}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className={styles.bottomNav}>
        <button type="button" onClick={() => setActiveTab('home')} className={`${styles.bottomNavBtn} ${activeTab === 'home' ? styles.bottomNavBtnActive : ''}`}>
          <Home size={18} />
          <span>Home</span>
        </button>
        <button type="button" onClick={() => setActiveTab('loan')} className={`${styles.bottomNavBtn} ${activeTab === 'loan' ? styles.bottomNavBtnActive : ''}`}>
          <CreditCard size={18} />
          <span>Facility</span>
        </button>
        <button type="button" onClick={() => setActiveTab('payments')} className={`${styles.bottomNavBtn} ${activeTab === 'payments' ? styles.bottomNavBtnActive : ''}`}>
          <Calendar size={18} />
          <span>Payments</span>
        </button>
        <button type="button" onClick={() => setActiveTab('documents')} className={`${styles.bottomNavBtn} ${activeTab === 'documents' ? styles.bottomNavBtnActive : ''}`}>
          <BookOpen size={18} />
          <span>Docs</span>
        </button>
        <button type="button" onClick={() => setActiveTab('profile')} className={`${styles.bottomNavBtn} ${activeTab === 'profile' ? styles.bottomNavBtnActive : ''}`}>
          <User size={18} />
          <span>Profile</span>
        </button>
      </nav>

      {/* EXECUTED CONTRACT SNAPSHOT MODAL */}
      {showContractModal && activeLoan && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setShowContractModal(false); }}>
          <div className={styles.modalDialog}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Executed Contract Legal Snapshot</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => window.print()} className={styles.actionBtnOutline}>
                  <Printer size={14} /> Print Contract
                </button>
                <button type="button" onClick={() => setShowContractModal(false)} className={styles.modalCloseBtn} aria-label="Close">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className={styles.modalScroll}>
              {activeLoan.contractTemplateSnapshot ? (
                <div>
                  <div style={{ borderBottom: '2px solid #064e3b', paddingBottom: '10px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h2 style={{ fontSize: '13pt', fontWeight: '900', color: '#064e3b', margin: 0, textTransform: 'uppercase' }}>
                        TRIBUTE CREDIT COOPERATIVE
                      </h2>
                      <p style={{ fontSize: '7.5pt', color: '#047857', fontWeight: '800', margin: '2px 0 0 0' }}>
                        MICROFINANCE PROMISSORY NOTE &amp; FACILITY AGREEMENT
                      </p>
                    </div>
                    <span style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '3px 8px', borderRadius: '4px', fontSize: '8pt', fontWeight: '800' }}>
                      VERSION {activeLoan.contractTemplateSnapshot.version} (EXECUTED)
                    </span>
                  </div>

                  <div style={{ fontSize: '8pt', lineHeight: '1.5', color: '#1e293b', marginBottom: '14px' }}>
                    <h4 style={{ fontWeight: '800', textTransform: 'uppercase', marginBottom: '4px' }}>
                      {activeLoan.contractTemplateSnapshot.sections.promissoryTitle}
                    </h4>
                    <div
                      dangerouslySetInnerHTML={{
                        __html: interpolateContractHtml(
                          activeLoan.contractTemplateSnapshot.sections.promissoryHtml,
                          {
                            totalScheduledCollections: `₱ ${Number(loanCalc?.totalScheduledCollections || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
                            installmentAmount: `₱ ${Number(loanCalc?.installmentPerFrequency || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
                            repaymentFrequency: activeLoan.paymentMode || 'Weekly',
                            termMonths: activeLoan.termMonths || 3,
                            principal: `₱ ${Number(activeLoan.finalContractAmount ?? activeLoan.adminApprovedAmount ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
                            borrowerName: activeLoan.borrowerName || user?.name,
                            policyNo: activeLoan.policyNo || 'LCAP-001',
                          }
                        ),
                      }}
                    />

                    <h4 style={{ fontWeight: '800', textTransform: 'uppercase', margin: '12px 0 4px 0' }}>
                      {activeLoan.contractTemplateSnapshot.sections.defaultTitle}
                    </h4>
                    <div
                      dangerouslySetInnerHTML={{
                        __html: interpolateContractHtml(
                          activeLoan.contractTemplateSnapshot.sections.defaultHtml,
                          {
                            totalScheduledCollections: `₱ ${Number(loanCalc?.totalScheduledCollections || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
                            installmentAmount: `₱ ${Number(loanCalc?.installmentPerFrequency || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
                            repaymentFrequency: activeLoan.paymentMode || 'Weekly',
                            termMonths: activeLoan.termMonths || 3,
                            principal: `₱ ${Number(activeLoan.finalContractAmount ?? activeLoan.adminApprovedAmount ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
                            borrowerName: activeLoan.borrowerName || user?.name,
                            policyNo: activeLoan.policyNo || 'LCAP-001',
                          }
                        ),
                      }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    {[0, 1, 2].map((idx) => {
                      const sigObj = activeLoan.borrowerSignatures && activeLoan.borrowerSignatures[idx];
                      const sigUrl = sigObj?.signature || (idx === 0 ? activeLoan.applicantSignature : undefined);
                      return (
                        <div key={idx} style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '6px', textAlign: 'center', backgroundColor: '#f8fafc' }}>
                          <span style={{ fontSize: '6pt', fontWeight: '800', color: '#64748b', display: 'block' }}>Borrower Specimen #{idx + 1}</span>
                          {sigUrl ? (
                            <img src={sigUrl} alt={`Borrower Sig ${idx + 1}`} style={{ maxHeight: '30px', maxWidth: '90%', margin: '4px auto' }} />
                          ) : (
                            <span style={{ fontSize: '7pt', color: '#94a3b8' }}>Pending</span>
                          )}
                          <span style={{ fontSize: '5.5pt', color: '#64748b', display: 'block' }}>{sigObj?.authId || 'Auth Recorded'}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                  Executed contract snapshot not available for this record.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PASSBOOK BOOKLET MODAL */}
      {showPassbookModal && passbookData && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setShowPassbookModal(false); }}>
          <div className={styles.modalDialog} style={{ maxWidth: '950px' }}>
            <div className={styles.modalHeader}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setPassbookSubTab('booklet')}
                  className={passbookSubTab === 'booklet' ? styles.actionBtnGreen : styles.actionBtnOutline}
                >
                  <BookOpen size={14} /> Official Booklet
                </button>
                <button
                  type="button"
                  onClick={() => setPassbookSubTab('ledger')}
                  className={passbookSubTab === 'ledger' ? styles.actionBtnGreen : styles.actionBtnOutline}
                >
                  <Calendar size={14} /> Payment Ledger
                </button>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => window.print()} className={styles.actionBtnOutline}>
                  <Printer size={14} /> Print Passbook
                </button>
                <button type="button" onClick={() => setShowPassbookModal(false)} className={styles.modalCloseBtn} aria-label="Close">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className={styles.modalScroll}>
              {passbookSubTab === 'booklet' ? (
                <PassbookBooklet data={passbookData} />
              ) : (
                <LoanPaymentLedger data={passbookData} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
