'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { OfficerSidebar } from '@/components/officer/OfficerSidebar';
import { OfficerMobileNav } from '@/components/officer/OfficerMobileNav';
import { SyncStatusBar } from '@/components/common/SyncStatusBar';
import { AppHeader } from '@/components/common/AppHeader';
import {
  getCreditAssessments,
  saveCreditAssessment,
  generateNextLoanReference,
  CreditAssessmentItem
} from '@/lib/credit-assessment-store';
import {
  calculateTributeLoan,
  TRIBUTE_GRACE_PRODUCTS
} from '@/lib/tribute-loan-engine';
import {
  Users2,
  Search,
  Filter,
  Calendar,
  Clock,
  Coins,
  ChevronRight,
  Phone,
  AlertCircle,
  CheckCircle,
  FileSpreadsheet,
  Printer,
  Plus,
  ArrowUpDown,
  BookOpen,
  X,
  Eye,
  UserCheck,
  MapPin,
  Building2,
  CreditCard,
  Shield,
  Users,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw
} from 'lucide-react';
import { SignaturePad } from '@/components/common/SignaturePad';
import { PassbookBooklet, LoanPaymentLedger, PassbookData } from '@/components/passbook/PassbookBooklet';
import { generateCollectionScheduleDates } from '@/lib/ph-holidays';
import theme from '@/components/officer/OfficerTheme.module.css';
import styles from './borrowers.module.css';

export default function CurrentBorrowersPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [borrowers, setBorrowers] = useState<CreditAssessmentItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProduct, setFilterProduct] = useState('All');
  const [sortBy, setSortBy] = useState<'dueDate' | 'name' | 'amount' | 'balance'>('dueDate');
  const [selectedBorrowerForLedger, setSelectedBorrowerForLedger] = useState<CreditAssessmentItem | null>(null);
  const [passbookModalBorrower, setPassbookModalBorrower] = useState<CreditAssessmentItem | null>(null);
  const [ledgerModalBorrower, setLedgerModalBorrower] = useState<CreditAssessmentItem | null>(null);
  const [passbookViewTab, setPassbookViewTab] = useState<'all' | 'inside' | 'ledger'>('all');
  const [detailsModalBorrower, setDetailsModalBorrower] = useState<CreditAssessmentItem | null>(null);
  const handledDeepLinkRef = useRef(false);

  // Pay Loan Modal State
  const [payLoanModalBorrower, setPayLoanModalBorrower] = useState<CreditAssessmentItem | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'gcash' | 'maya' | 'bank_transfer'>('cash');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [paymentSuccessMsg, setPaymentSuccessMsg] = useState<string>('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState<boolean>(false);
  const [paymentAoSignature, setPaymentAoSignature] = useState<string>('');

  // Deposit/Withdraw Savings Modal State
  const [savingsModalBorrower, setSavingsModalBorrower] = useState<CreditAssessmentItem | null>(null);
  const [savingsActionType, setSavingsActionType] = useState<'deposit' | 'withdraw'>('deposit');
  const [savingsAmount, setSavingsAmount] = useState<number>(0);
  const [savingsMethod, setSavingsMethod] = useState<'cash' | 'gcash' | 'maya' | 'bank_transfer'>('cash');
  const [savingsNotes, setSavingsNotes] = useState<string>('');
  const [savingsSuccessMsg, setSavingsSuccessMsg] = useState<string>('');
  const [isSubmittingSavings, setIsSubmittingSavings] = useState<boolean>(false);
  const [savingsAoSignature, setSavingsAoSignature] = useState<string>('');

  // Renewal Modal State
  const [renewalModalBorrower, setRenewalModalBorrower] = useState<CreditAssessmentItem | null>(null);
  const [renewalProduct, setRenewalProduct] = useState<string>('Regular Loan');
  const [renewalAmount, setRenewalAmount] = useState<number>(20000);
  const [renewalTerm, setRenewalTerm] = useState<number>(3);
  const [renewalPaymentMode, setRenewalPaymentMode] = useState<'Daily' | 'Weekly' | 'Semi-Monthly' | 'Monthly'>('Weekly');
  const [renewalOffsetBalance, setRenewalOffsetBalance] = useState<boolean>(true);
  const [renewalNotes, setRenewalNotes] = useState<string>('');
  const [renewalAoSignature, setRenewalAoSignature] = useState<string>('');
  const [renewalSuccessMsg, setRenewalSuccessMsg] = useState<string>('');
  const [isSubmittingRenewal, setIsSubmittingRenewal] = useState<boolean>(false);

  const handlePrintDocument = (target: 'ledger' | 'passbook' | 'details' | 'payment-ledger', borrower?: CreditAssessmentItem) => {
    if (borrower) {
      setSelectedBorrowerForLedger(borrower);
    }
    document.body.classList.remove('print-mode-contract', 'print-mode-schedule', 'print-mode-ledger', 'print-mode-all', 'print-mode-passbook', 'print-mode-payment-ledger', 'print-mode-details');
    document.body.classList.add(`print-mode-${target}`);

    // Explicitly inject dynamic @page orientation into head
    const existingStyle = document.getElementById('dynamic-print-orientation-style');
    if (existingStyle) {
      existingStyle.remove();
    }

    const styleEl = document.createElement('style');
    styleEl.id = 'dynamic-print-orientation-style';
    if (target === 'details') {
      styleEl.innerHTML = `@page { size: A4 portrait !important; margin: 8mm !important; }`;
    } else {
      styleEl.innerHTML = `@page { size: A4 landscape !important; margin: 4mm !important; }`;
    }
    document.head.appendChild(styleEl);

    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.body.classList.remove('print-mode-contract', 'print-mode-schedule', 'print-mode-ledger', 'print-mode-all', 'print-mode-passbook', 'print-mode-payment-ledger', 'print-mode-details');
        const s = document.getElementById('dynamic-print-orientation-style');
        if (s) s.remove();
      }, 1000);
    }, 150);
  };

  const handlePrintLedger = (borrower: CreditAssessmentItem) => {
    handlePrintDocument('payment-ledger', borrower);
  };

  const handleOpenPassbookModal = (borrower: CreditAssessmentItem) => {
    setPassbookModalBorrower(borrower);
    setSelectedBorrowerForLedger(borrower);
  };

  const handleOpenLedgerModal = (borrower: CreditAssessmentItem) => {
    setLedgerModalBorrower(borrower);
    setSelectedBorrowerForLedger(borrower);
  };

  useEffect(() => {
    // Check if viewPassbook or viewDetails was passed in query parameter
    const checkDeepLink = (mergedList: CreditAssessmentItem[]) => {
      if (typeof window === 'undefined' || handledDeepLinkRef.current) return;
      const params = new URLSearchParams(window.location.search);
      const passbookId = params.get('viewPassbook');
      const detailsId = params.get('viewDetails') || params.get('id');

      if (passbookId) {
        const target = mergedList.find(b => 
          b.id === passbookId || 
          b.applicationId === passbookId || 
          b.policyNo === passbookId || 
          (b.mcid && b.mcid === passbookId) ||
          (b.borrowerName && b.borrowerName.toLowerCase() === passbookId.toLowerCase())
        );
        if (target) {
          handledDeepLinkRef.current = true;
          setSelectedBorrowerForLedger(target);
          setPassbookModalBorrower(target);
          try {
            params.delete('viewPassbook');
            const newQuery = params.toString();
            const newUrl = window.location.pathname + (newQuery ? `?${newQuery}` : '');
            window.history.replaceState(null, '', newUrl);
          } catch (e) {}
        }
      } else if (detailsId) {
        const target = mergedList.find(b => 
          b.id === detailsId || 
          b.applicationId === detailsId || 
          b.policyNo === detailsId || 
          (b.mcid && b.mcid === detailsId)
        );
        if (target) {
          handledDeepLinkRef.current = true;
          setDetailsModalBorrower(target);
          try {
            params.delete('viewDetails');
            params.delete('id');
            const newQuery = params.toString();
            const newUrl = window.location.pathname + (newQuery ? `?${newQuery}` : '');
            window.history.replaceState(null, '', newUrl);
          } catch (e) {}
        }
      }
    };

    const loadBorrowers = async () => {
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

      setBorrowers([...list]);
      checkDeepLink(list);
    };

    loadBorrowers();

    window.addEventListener('storage', loadBorrowers);
    const poller = setInterval(loadBorrowers, 2000);

    return () => {
      window.removeEventListener('storage', loadBorrowers);
      clearInterval(poller);
    };
  }, []);

  // Filter and Sort active borrowers
  const activeBorrowers = borrowers.filter((b) => {
    // Show disbursed or ready borrowers
    const isRelevant = b.status === 'disbursed' || b.status === 'contract_ready' || b.status === 'admin_approved';
    if (!isRelevant) return false;

    const matchesSearch =
      b.borrowerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.policyNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.location.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (filterProduct !== 'All' && b.productName !== filterProduct) return false;
    return true;
  });

  // Sorting
  const sortedBorrowers = [...activeBorrowers].sort((a, b) => {
    if (sortBy === 'name') {
      return a.borrowerName.localeCompare(b.borrowerName);
    }
    if (sortBy === 'amount') {
      const aAmt = a.finalContractAmount || a.adminApprovedAmount || a.requestedAmount;
      const bAmt = b.finalContractAmount || b.adminApprovedAmount || b.requestedAmount;
      return bAmt - aAmt;
    }
    if (sortBy === 'balance') {
      return (b.remainingBalance || 0) - (a.remainingBalance || 0);
    }
    // Default: upcoming due dates first
    const aDate = a.nextDueDate ? new Date(a.nextDueDate).getTime() : Date.now() + 86400000;
    const bDate = b.nextDueDate ? new Date(b.nextDueDate).getTime() : Date.now() + 86400000;
    return aDate - bDate;
  });

  const totalPortfolio = sortedBorrowers.reduce((sum, b) => {
    return sum + (b.finalContractAmount || b.adminApprovedAmount || b.requestedAmount || 0);
  }, 0);

  const totalCbu = sortedBorrowers.reduce((sum, b) => {
    const amt = b.finalContractAmount || b.adminApprovedAmount || b.requestedAmount || 0;
    return sum + (amt * 0.05);
  }, 0);

  return (
    <div className={`${theme.themeRoot} ${theme.pageShell}`}>
      <OfficerSidebar isMobileOpen={mobileMenuOpen} onCloseMobile={() => setMobileMenuOpen(false)} />

      <main className={`officer-main-content ${theme.mainContent}`} style={{ flex: 1, padding: '24px', overflowY: 'auto', paddingBottom: '90px' }}>
        <AppHeader
          panelType="officer"
          userName="Officer Juan"
          badgeLabel="Active Loan Ledger"
          pageTitle="Current Borrowers & Repayment Dues"
          pageSubtitle="Live repayment schedules, CBU balances, and official passbook ledger generation."
          onOpenMobileSidebar={() => setMobileMenuOpen(prev => !prev)}
          actions={
            <Link
              href="/officer/borrowers/new"
              className={styles.headerCta}
            >
              <Plus size={16} /> New Application
            </Link>
          }
        />

        {/* Quick Metrics Bar (Screen Only) */}
        <div className={`no-print ${styles.metricsGrid}`}>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Active Borrowers</span>
            <p className={styles.metricValue}>
              {sortedBorrowers.length}
            </p>
          </div>

          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Active Loan Portfolio</span>
            <p className={`${styles.metricValue} ${styles.metricValueGreen}`}>
              ₱ {totalPortfolio.toLocaleString('en-PH')}
            </p>
          </div>

          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Total CBU Collateral</span>
            <p className={`${styles.metricValue} ${styles.metricValueEmerald}`}>
              ₱ {totalCbu.toLocaleString('en-PH')}
            </p>
          </div>

          <div className={`${styles.metricCard} ${styles.metricCardWarning}`}>
            <span className={styles.metricLabel}>Upcoming Dues Today</span>
            <p className={`${styles.metricValue} ${styles.metricValueAmber}`}>
              {sortedBorrowers.filter(b => b.status === 'disbursed').length}
            </p>
          </div>
        </div>

        {/* Filter & Sort Controls (Screen Only) */}
        <div className={`no-print ${styles.filterBar}`}>
          {/* Search */}
          <div className={styles.searchBox}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search by borrower name, policy, barangay..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          {/* Product Filter */}
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Product:</span>
            <select
              value={filterProduct}
              onChange={(e) => setFilterProduct(e.target.value)}
              className={styles.selectInput}
            >
              <option value="All">All Products</option>
              <option value="Regular Loan">Regular Loan</option>
              <option value="Small Business Loan">Small Business Loan</option>
              <option value="Emergency Loan">Emergency Loan</option>
            </select>
          </div>

          {/* Sort By Due Date */}
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>
              <ArrowUpDown size={14} /> Sort By:
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className={styles.selectSort}
            >
              <option value="dueDate">Upcoming Due Dates (Earliest First)</option>
              <option value="name">Borrower Name (A-Z)</option>
              <option value="amount">Loan Amount (High to Low)</option>
              <option value="balance">Remaining Balance</option>
            </select>
          </div>
        </div>

        {/* Borrowers Table (Desktop >= 1024px) */}
        <div className={`no-print ${styles.tableCard}`}>
          <div className={styles.desktopTableWrap}>
            <table className={styles.table}>
              <thead>
                <tr className={styles.tableHeadRow}>
                  <th className={styles.th}>Borrower / Member</th>
                  <th className={styles.th}>Policy No.</th>
                  <th className={`${styles.th} ${styles.thMcid}`}>MCID</th>
                  <th className={styles.th}>Product & Term</th>
                  <th className={`${styles.th} ${styles.thRight}`}>Principal Loan</th>
                  <th className={`${styles.th} ${styles.thRight}`}>Scheduled Installment</th>
                  <th className={styles.th}>Next Due Date</th>
                  <th className={`${styles.th} ${styles.thRight}`}>CBU Balance</th>
                  <th className={`${styles.th} ${styles.thCenter}`}>Loan Status</th>
                  <th className={`${styles.th} ${styles.thCenter}`}>Action</th>
                </tr>
              </thead>
              <tbody>
                {sortedBorrowers.length === 0 ? (
                  <tr>
                    <td colSpan={10} className={styles.emptyCell}>
                      No active current borrowers matching filter criteria.
                    </td>
                  </tr>
                ) : (
                  sortedBorrowers.map((b, idx) => {
                    const principal = b.finalContractAmount || b.adminApprovedAmount || b.requestedAmount || 10000;
                    const calc = calculateTributeLoan(principal, b.termMonths, b.productName, b.paymentMode);
                    
                    // Accurate next due date using Philippine holiday calendar
                    let dueDateStr = '';
                    if (b.nextDueDate) {
                      dueDateStr = new Date(b.nextDueDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
                    } else {
                      const baseDate = b.disbursedAt ? new Date(b.disbursedAt) : new Date();
                      const schedDates = generateCollectionScheduleDates(
                        isNaN(baseDate.getTime()) ? new Date() : baseDate,
                        b.termMonths || 3,
                        b.paymentMode || 'Weekly',
                        1
                      );
                      dueDateStr = schedDates[0] ? schedDates[0].shortDateStr : new Date(Date.now() + 86400000 * 7).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
                    }

                    const mcidDisplay = b.mcid || b.cidNumber || 'TCID-A-00001';

                    return (
                      <tr key={b.id || idx} className={styles.tr}>
                        {/* Borrower Name & Contact */}
                        <td className={styles.td}>
                          <strong className={styles.borrowerName}>
                            {b.borrowerName}
                          </strong>
                          <span className={styles.borrowerSub}>
                            {b.contactNumber} • {b.location.split(',')[0]}
                          </span>
                        </td>

                        {/* Policy No */}
                        <td className={`${styles.td} ${styles.policyMono}`}>
                          {b.policyNo}
                        </td>

                        {/* MCID (Cooperative ID) */}
                        <td className={styles.td}>
                          <span className={styles.mcidBadge}>
                            {mcidDisplay}
                          </span>
                        </td>

                        {/* Product & Frequency */}
                        <td className={styles.td}>
                          <span className={styles.productTitle}>{b.productName}</span>
                          <span className={styles.productSub}>
                            {b.paymentMode} Mode ({b.termMonths} mos)
                          </span>
                        </td>

                        {/* Principal Amount */}
                        <td className={`${styles.tdRight} ${styles.principalVal}`}>
                          ₱ {principal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </td>

                        {/* Scheduled Due */}
                        <td className={styles.tdRight}>
                          <strong className={styles.installmentVal}>
                            ₱ {calc.installmentPerFrequency.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </strong>
                          <span className={styles.installmentSub}>
                            per {b.paymentMode.toLowerCase()}
                          </span>
                        </td>

                        {/* Next Due Date */}
                        <td className={styles.td}>
                          <span className={styles.dueDateBadge}>
                            <Calendar size={12} /> {dueDateStr}
                          </span>
                        </td>

                        {/* CBU Balance */}
                        <td className={`${styles.tdRight} ${styles.cbuVal}`}>
                          ₱ {calc.cbuAmount.toLocaleString('en-PH')}
                        </td>

                        {/* Status */}
                        <td className={styles.tdCenter}>
                          {(() => {
                            const isFullyPaid = (b.remainingBalance !== undefined ? b.remainingBalance <= 0 : (b.totalCollected || 0) >= calc.contractualBalance);
                            if (isFullyPaid) {
                              return (
                                <span className={styles.statusPaid}>
                                  ✓ Fully Paid (100%)
                                </span>
                              );
                            }
                            return (
                              <span className={b.status === 'disbursed' ? styles.statusActive : styles.statusAwaiting}>
                                {b.status === 'disbursed' ? 'Active / Disbursed' : 'Awaiting Payout'}
                              </span>
                            );
                          })()}
                        </td>

                        {/* Action: Pay Loan, Savings, Details, Passbook, Payment Ledger */}
                        <td className={styles.tdCenter}>
                          <div className={styles.actionCluster}>
                            {/* Top Tier: Primary Transaction Operations */}
                            <div className={styles.actionRowPrimary}>
                              {(() => {
                                const isFullyPaid = (b.remainingBalance !== undefined ? b.remainingBalance <= 0 : (b.totalCollected || 0) >= calc.contractualBalance);
                                if (isFullyPaid) {
                                  return (
                                    <button
                                      type="button"
                                      disabled={true}
                                      className={styles.btnFullyPaid}
                                      title="Loan is 100% Fully Settled. No outstanding balance."
                                    >
                                      <CreditCard size={13} color="#94a3b8" /> Fully Paid
                                    </button>
                                  );
                                }
                                return (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPayLoanModalBorrower(b);
                                      setPaymentAmount(calc.installmentPerFrequency);
                                      setPaymentNotes('');
                                      setPaymentSuccessMsg('');
                                    }}
                                    className={styles.btnPayLoan}
                                    title="Collect & Record Loan Installment Payment"
                                  >
                                    <CreditCard size={13} color="#ffffff" /> Pay Loan
                                  </button>
                                );
                              })()}
                              <button
                                type="button"
                                onClick={() => {
                                  setSavingsModalBorrower(b);
                                  setSavingsActionType('deposit');
                                  setSavingsAmount(100);
                                  setSavingsNotes('');
                                  setSavingsSuccessMsg('');
                                }}
                                className={styles.btnSavings}
                                title="Deposit or Withdraw Member Savings / CBU Equity"
                              >
                                <Wallet size={13} color="#15803d" /> Savings (CBU)
                              </button>
                            </div>

                            {/* Renewal Button for Eligible Borrowers */}
                            {(() => {
                              const totalPaid = b.totalCollected || 0;
                              const currentRemBal = b.remainingBalance !== undefined ? b.remainingBalance : Math.max(0, calc.contractualBalance - totalPaid);
                              const singleInst = calc.installmentPerFrequency || 0;
                              // Eligible if remaining balance is 0 or less than 2 installments
                              const isEligible = currentRemBal <= singleInst * 2;

                              return isEligible ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRenewalModalBorrower(b);
                                    setRenewalProduct(b.productName || 'Regular Loan');
                                    // Default proposed renewal amount: previous principal or increment
                                    const nextProposed = Math.min(
                                      (TRIBUTE_GRACE_PRODUCTS[b.productName]?.absoluteMax || 50000),
                                      principal + 5000
                                    );
                                    setRenewalAmount(nextProposed);
                                    setRenewalTerm(b.termMonths || 3);
                                    setRenewalPaymentMode(b.paymentMode || 'Weekly');
                                    setRenewalOffsetBalance(currentRemBal > 0);
                                    setRenewalNotes('');
                                    setRenewalAoSignature('');
                                    setRenewalSuccessMsg('');
                                  }}
                                  className={styles.btnRenew}
                                  title="Renew Loan Facility for Member"
                                >
                                  <RotateCcw size={12} color="#047857" /> Renew Loan (Cycle {(b.loanCycle || 1) + 1})
                                </button>
                              ) : null;
                            })()}

                            {/* Bottom Tier: Records & Passbooks */}
                            <div className={styles.actionRowSecondary}>
                              <button
                                type="button"
                                onClick={() => setDetailsModalBorrower(b)}
                                className={styles.btnRecord}
                                title="View all detailed information of borrower"
                              >
                                <Eye size={12} color="#15803d" /> Details
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenPassbookModal(b)}
                                className={styles.btnRecord}
                                title="View & Print Official Member Passbook (Includes Loan Payment Record)"
                              >
                                <BookOpen size={12} color="#15803d" /> Passbook
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenLedgerModal(b)}
                                className={styles.btnRecordGreen}
                                title="View & Print Official Loan Payment Ledger (Field Copy)"
                              >
                                <FileSpreadsheet size={12} color="#15803d" /> Ledger
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile / Tablet Borrower Cards (< 1024px, Screen Only) */}
        <div className={`no-print ${styles.mobileCardList}`}>
          {sortedBorrowers.length === 0 ? (
            <div className={styles.mobileCard} style={{ textAlign: 'center', color: '#64748b', padding: '32px 16px' }}>
              No active current borrowers matching filter criteria.
            </div>
          ) : (
            sortedBorrowers.map((b, idx) => {
              const principal = b.finalContractAmount || b.adminApprovedAmount || b.requestedAmount || 10000;
              const calc = calculateTributeLoan(principal, b.termMonths, b.productName, b.paymentMode);

              let dueDateStr = '';
              if (b.nextDueDate) {
                dueDateStr = new Date(b.nextDueDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
              } else {
                const baseDate = b.disbursedAt ? new Date(b.disbursedAt) : new Date();
                const schedDates = generateCollectionScheduleDates(
                  isNaN(baseDate.getTime()) ? new Date() : baseDate,
                  b.termMonths || 3,
                  b.paymentMode || 'Weekly',
                  1
                );
                dueDateStr = schedDates[0] ? schedDates[0].shortDateStr : baseDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
              }

              const mcidDisplay = b.mcid || b.cidNumber || 'TCID-A-00001';
              const isFullyPaid = (b.remainingBalance !== undefined ? b.remainingBalance <= 0 : (b.totalCollected || 0) >= calc.contractualBalance);
              const totalPaid = b.totalCollected || 0;
              const currentRemBal = b.remainingBalance !== undefined ? b.remainingBalance : Math.max(0, calc.contractualBalance - totalPaid);
              const singleInst = calc.installmentPerFrequency || 0;
              const isEligible = currentRemBal <= singleInst * 2;

              return (
                <div key={`mob-${b.id || idx}`} className={styles.mobileCard}>
                  <div className={styles.mobileCardTop}>
                    <div>
                      <strong className={styles.borrowerName}>{b.borrowerName}</strong>
                      <span className={styles.borrowerSub}>{b.contactNumber} • {b.location.split(',')[0]}</span>
                    </div>
                    {isFullyPaid ? (
                      <span className={styles.statusPaid}>✓ Fully Paid (100%)</span>
                    ) : (
                      <span className={b.status === 'disbursed' ? styles.statusActive : styles.statusAwaiting}>
                        {b.status === 'disbursed' ? 'Active / Disbursed' : 'Awaiting Payout'}
                      </span>
                    )}
                  </div>

                  <div className={styles.mobileBadgeRow}>
                    <span className={styles.mcidBadge}>{mcidDisplay}</span>
                    <span className={styles.policyMono}>Policy: {b.policyNo}</span>
                    <span className={styles.dueDateBadge}>
                      <Calendar size={12} /> {dueDateStr}
                    </span>
                  </div>

                  <div className={styles.mobileMetricsGrid}>
                    <div className={styles.mobileMetricItem}>
                      <span className={styles.mobileMetricLabel}>Product & Term</span>
                      <span className={styles.productTitle}>{b.productName} ({b.termMonths}m)</span>
                    </div>
                    <div className={styles.mobileMetricItem}>
                      <span className={styles.mobileMetricLabel}>Principal Loan</span>
                      <span className={styles.principalVal}>₱ {principal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className={styles.mobileMetricItem}>
                      <span className={styles.mobileMetricLabel}>Scheduled Due ({b.paymentMode})</span>
                      <span className={styles.installmentVal}>₱ {calc.installmentPerFrequency.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className={styles.mobileMetricItem}>
                      <span className={styles.mobileMetricLabel}>CBU Balance</span>
                      <span className={styles.cbuVal}>₱ {calc.cbuAmount.toLocaleString('en-PH')}</span>
                    </div>
                  </div>

                  <div className={styles.mobileActionGrid}>
                    {isFullyPaid ? (
                      <button
                        type="button"
                        disabled={true}
                        className={`${styles.btnFullyPaid} ${styles.mobileBtnTouch}`}
                      >
                        <CreditCard size={13} color="#94a3b8" /> Fully Paid
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setPayLoanModalBorrower(b);
                          setPaymentAmount(calc.installmentPerFrequency);
                          setPaymentNotes('');
                          setPaymentSuccessMsg('');
                        }}
                        className={`${styles.btnPayLoan} ${styles.mobileBtnTouch}`}
                      >
                        <CreditCard size={13} color="#ffffff" /> Pay Loan
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setSavingsModalBorrower(b);
                        setSavingsActionType('deposit');
                        setSavingsAmount(100);
                        setSavingsNotes('');
                        setSavingsSuccessMsg('');
                      }}
                      className={`${styles.btnSavings} ${styles.mobileBtnTouch}`}
                    >
                      <Wallet size={13} color="#15803d" /> Savings (CBU)
                    </button>
                    {isEligible && (
                      <button
                        type="button"
                        onClick={() => {
                          setRenewalModalBorrower(b);
                          setRenewalProduct(b.productName || 'Regular Loan');
                          const nextProposed = Math.min(
                            (TRIBUTE_GRACE_PRODUCTS[b.productName]?.absoluteMax || 50000),
                            principal + 5000
                          );
                          setRenewalAmount(nextProposed);
                          setRenewalTerm(b.termMonths || 3);
                          setRenewalPaymentMode(b.paymentMode || 'Weekly');
                          setRenewalOffsetBalance(currentRemBal > 0);
                          setRenewalNotes('');
                          setRenewalAoSignature('');
                          setRenewalSuccessMsg('');
                        }}
                        className={`${styles.btnRenew} ${styles.mobileBtnTouch} ${styles.mobileActionFull}`}
                      >
                        <RotateCcw size={12} color="#047857" /> Renew Loan (Cycle {(b.loanCycle || 1) + 1})
                      </button>
                    )}
                  </div>

                  <div className={styles.mobileDocRow}>
                    <button
                      type="button"
                      onClick={() => setDetailsModalBorrower(b)}
                      className={`${styles.btnRecord} ${styles.mobileBtnTouch}`}
                    >
                      <Eye size={12} color="#15803d" /> Details
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenPassbookModal(b)}
                      className={`${styles.btnRecord} ${styles.mobileBtnTouch}`}
                    >
                      <BookOpen size={12} color="#15803d" /> Passbook
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenLedgerModal(b)}
                      className={`${styles.btnRecordGreen} ${styles.mobileBtnTouch}`}
                    >
                      <FileSpreadsheet size={12} color="#15803d" /> Ledger
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ============================================================== */}
        {/* OFFICIAL PRINTABLE PASSBOOK BOOKLET & LEDGER (PRINT ONLY)      */}
        {/* ============================================================== */}
        {selectedBorrowerForLedger && (() => {
          const b = selectedBorrowerForLedger;
          const principal = b.finalContractAmount || b.adminApprovedAmount || b.requestedAmount;
          const isRenewal = (b.loanCycle || 1) > 1;
          const calc = calculateTributeLoan(principal, b.termMonths, b.productName, b.paymentMode, isRenewal);
          const cbuInitial = calc.cbuAmount;
          const releaseDate = b.disbursedAt 
            ? new Date(b.disbursedAt).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
            : new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });

          const aoSig = b.evaluatedByOfficer ? `${b.evaluatedByOfficer.replace(/\s+/g, '_').toUpperCase()}-AUTH0012220-A` : 'ROLANDO_ROBLES-AUTH0012220-A';
          const mgrSig = 'DENNIS_YUAN-AUTH0002912-C';

          // Extract biometrics & signatures with fallbacks across fullProfile and Step 1/7
          const p: any = b.fullProfile || {};
          const s1: any = p.step1 || {};
          const facePhoto = b.applicantFacePhoto || p.applicantFacePhoto || s1.applicantFacePhoto;
          const holdingPhoto = b.borrowerHoldingIdPhoto || p.borrowerHoldingIdPhoto;
          const borrowerSigs = (b.borrowerSignatures && b.borrowerSignatures.length > 0)
            ? b.borrowerSignatures
            : (p.borrowerSignatures && p.borrowerSignatures.length > 0)
            ? p.borrowerSignatures
            : (b.applicantSignature || p.applicantSignature)
            ? [
                { signature: b.applicantSignature || p.applicantSignature, authId: 'AUTH-BRW-001-S1', timestamp: b.evaluatedAt || 'Nov 5, 2026 07:24 PM' },
                { signature: b.applicantSignature || p.applicantSignature, authId: 'AUTH-BRW-001-S2', timestamp: b.evaluatedAt || 'Nov 5, 2026 07:25 PM' },
                { signature: b.applicantSignature || p.applicantSignature, authId: 'AUTH-BRW-001-S3', timestamp: b.evaluatedAt || 'Nov 5, 2026 07:26 PM' },
              ]
            : undefined;
          const primarySig = b.applicantSignature || p.applicantSignature || (borrowerSigs && borrowerSigs[0]?.signature);
          const aoSigs = (b.officerSignatures && b.officerSignatures.length > 0)
            ? b.officerSignatures
            : (p.officerSignatures && p.officerSignatures.length > 0)
            ? p.officerSignatures
            : undefined;

          // Generate collection schedule according to Philippine holiday calendar & payment mode
          const parsedApprovalDate = b.disbursedAt ? new Date(b.disbursedAt) : new Date();
          const baseApprovalDate = isNaN(parsedApprovalDate.getTime()) ? new Date() : parsedApprovalDate;
          const officialSched = generateCollectionScheduleDates(
            baseApprovalDate,
            b.termMonths || 3,
            b.paymentMode || 'Weekly'
          );

          const samplePayments = (b.paymentLedgerRecords && b.paymentLedgerRecords.length > 0)
            ? b.paymentLedgerRecords
            : officialSched.map((item, sIdx) => {
                const interestPerInst = Math.round(calc.totalInterest / calc.numberOfInstallments);
                return {
                  installmentNo: item.installmentNo,
                  paymentSchedule: item.dateStr,
                  status: 'Pending' as const,
                  principalAmount: principal,
                  interest: interestPerInst,
                };
              });

          const currentCbuBalance = b.savingsBalance !== undefined ? b.savingsBalance : cbuInitial;

          const sampleCbu = (b.savingsLedgerRecords && b.savingsLedgerRecords.length > 0)
            ? [
                {
                  paymentSchedule: releaseDate,
                  datePaid: releaseDate,
                  cbuIn: cbuInitial,
                  cbuOut: 0,
                  cbuBalance: cbuInitial,
                  aoSignature: aoSig.replace('AUTH0012220-A', 'AUTH0012222-A')
                },
                ...b.savingsLedgerRecords.map(s => ({
                  paymentSchedule: s.notes || (s.type === 'deposit' ? 'Member Deposit' : 'Member Withdrawal'),
                  datePaid: s.date,
                  cbuIn: s.type === 'deposit' ? s.amount : 0,
                  cbuOut: s.type === 'withdraw' ? s.amount : 0,
                  cbuBalance: s.runningBalance,
                  aoSignature: s.aoSignature || ((b.evaluatedByOfficer ? b.evaluatedByOfficer.replace(/\s+/g, '_').toUpperCase() : 'OFFICER_JUAN') + '-' + (s.referenceNo || 'REF-SAV')),
                  aoSignatureImage: s.aoSignatureImage
                }))
              ]
            : [
                {
                  paymentSchedule: releaseDate,
                  datePaid: releaseDate,
                  cbuIn: cbuInitial,
                  cbuOut: 0,
                  cbuBalance: cbuInitial,
                  aoSignature: aoSig.replace('AUTH0012220-A', 'AUTH0012222-A')
                }
              ];

          const passbookData: PassbookData = {
            borrowerName: b.borrowerName,
            cidNumber: b.cidNumber || b.mcid || s1.cooperativeId || b.policyNo || 'TCID-A-00001',
            loanReference: b.applicationId || 'TC-LN-A-00001',
            mcidNumber: b.mcid || b.cidNumber || s1.cooperativeId || 'TCID-A-00001',
            spouseName: b.spouseName || 'N/A',
            permanentAddress: b.location,
            membershipDate: b.membershipDate || releaseDate,
            dateIssued: releaseDate,
            issuedByName: b.evaluatedByOfficer || 'OFFICER JUAN DE LA CRUZ',
            issuedByDesignation: 'Account Officer (AO-001)',
            specimenSignature: primarySig,
            specimenSignatures: borrowerSigs,
            aoSignatures: aoSigs,
            memberFacePhoto: facePhoto,
            holdingIdPhoto: holdingPhoto,
            dateReleased: releaseDate,
            loanType: b.productName.replace(' Loan', ''),
            loanAmount: principal,
            termMonths: b.termMonths || 3,
            paymentMode: b.paymentMode || 'Weekly',
            disbursementType: b.disbursementMode === 'cash' ? 'Cash' : (b.disbursementChannel || 'Cash'),
            cycle: b.loanCycle || 1,
            aoSignatureName: aoSig,
            managerSignatureName: mgrSig,
            cbuInitialDeposit: cbuInitial,
            cbuBalance: currentCbuBalance,
            paymentRecords: samplePayments,
            cbuRecords: sampleCbu
          };

          return (
            <div className="official-print-bundle">
              {/* Unified Official Passbook & Microfinance Statement Print Document */}
              <div className="official-printable-page print-doc-passbook page-break-after" style={{ padding: '0', color: '#0f172a' }}>
                <PassbookBooklet data={passbookData} />
              </div>

              {/* Standalone Physical Loan Payment Ledger Print Document (Field Visit Borrower Copy) */}
              <div className="official-printable-page print-doc-payment-ledger print-doc-ledger page-break-after" style={{ padding: '0', color: '#0f172a' }}>
                <LoanPaymentLedger data={passbookData} />
              </div>

              {/* Separate Print Target: Official Borrower Dossier & Account Officer Profile Printout */}
              {(() => {
                const p = b.fullProfile || {};
                const s1 = p.step1 || {};
                const s2 = p.step2 || {};
                const s4 = p.step4 || {};
                const s5 = p.step5 || {};
                const mcid = b.mcid || b.cidNumber || s1.cooperativeId || 'TCID-A-00001';

                return (
                  <div className="official-printable-page print-doc-details" style={{ padding: '16px 20px', color: '#0f172a', fontFamily: 'Inter, sans-serif' }}>
                    {/* Modern Professional Bank Header */}
                    <div style={{ borderBottom: '2.5px solid #0f172a', paddingBottom: '12px', marginBottom: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <img
                            src="/tribute-credit-logo.png"
                            alt="Tribute Credit Cooperative"
                            style={{ height: '56px', width: 'auto', objectFit: 'contain' }}
                          />
                          <div style={{ borderLeft: '1.5px solid #cbd5e1', paddingLeft: '14px' }}>
                            <h1 style={{ fontSize: '12pt', fontWeight: '900', color: '#0f172a', margin: '0 0 2px 0', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                              TRIBUTE CREDIT COOPERATIVE
                            </h1>
                            <p style={{ fontSize: '7pt', color: '#047857', margin: 0, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                              REGULATED CREDIT & FINANCIAL SERVICES &bull; CDA REG. REF: NCR-COOP-88219
                            </p>
                            <p style={{ fontSize: '6.5pt', color: '#64748b', margin: '1px 0 0 0' }}>
                              Commonwealth Ave., Quezon City, Metro Manila &bull; Tel: (02) 8921-4400 &bull; contact@tribute-grace.org
                            </p>
                          </div>
                        </div>

                        {/* Document Classification Badge */}
                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                          <span style={{
                            fontSize: '6.5pt',
                            fontWeight: '900',
                            backgroundColor: '#0f172a',
                            color: '#ffffff',
                            padding: '3px 8px',
                            borderRadius: '3px',
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase'
                          }}>
                            OFFICIAL MEMBER DOSSIER
                          </span>
                          <span style={{ fontSize: '7pt', fontWeight: '800', fontFamily: 'monospace', color: '#047857' }}>
                            MCID: {mcid}
                          </span>
                          <span style={{ fontSize: '6.5pt', color: '#64748b', fontFamily: 'monospace' }}>
                            POLICY: {b.policyNo}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'center', marginBottom: '14px' }}>
                      <h2 style={{ fontSize: '11pt', fontWeight: '900', textTransform: 'uppercase', margin: '0 0 2px 0', letterSpacing: '0.5px', color: '#0f172a' }}>
                        CONFIDENTIAL BORROWER INFORMATION RECORD & CREDIT ASSESSMENT REPORT
                      </h2>
                      <p style={{ fontSize: '7pt', color: '#64748b', margin: 0 }}>
                        As Recorded & Certified by Account Officer &bull; Date Printed: {new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>

                    {/* Section 1: Personal Demographics */}
                    <div style={{ border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'hidden', marginBottom: '10px' }}>
                      <div style={{ backgroundColor: '#f1f5f9', padding: '4px 8px', borderBottom: '1px solid #cbd5e1', fontSize: '7.5pt', fontWeight: '800', color: '#1e293b', textTransform: 'uppercase' }}>
                        I. PERSONAL IDENTITY & DEMOGRAPHIC DETAILS (STEP 1)
                      </div>
                      <div style={{ padding: '6px 8px', fontSize: '7.5pt', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                        <div>
                          <span style={{ fontSize: '6.5pt', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Full Legal Name</span>
                          <strong>{b.borrowerName}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '6.5pt', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Cooperative ID (MCID)</span>
                          <strong style={{ fontFamily: 'monospace', color: '#047857' }}>{mcid}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '6.5pt', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>TGSWS Policy Number</span>
                          <strong style={{ fontFamily: 'monospace', color: '#0284c7' }}>{b.policyNo}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '6.5pt', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Date of Birth</span>
                          <strong>{s1.dateOfBirth || 'N/A'}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '6.5pt', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Civil Status & Sex</span>
                          <strong>{s1.civilStatus || 'Single'} / {s1.sex || 'Male'}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '6.5pt', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Nationality</span>
                          <strong>{s1.nationality || 'Filipino'}</strong>
                        </div>
                        <div style={{ gridColumn: 'span 2' }}>
                          <span style={{ fontSize: '6.5pt', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Recommending Member / Referral</span>
                          <strong>{s1.referral || 'Direct Account Officer Registration'}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Contact, Residence & Government IDs */}
                    <div style={{ border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'hidden', marginBottom: '10px' }}>
                      <div style={{ backgroundColor: '#f1f5f9', padding: '4px 8px', borderBottom: '1px solid #cbd5e1', fontSize: '7.5pt', fontWeight: '800', color: '#1e293b', textTransform: 'uppercase' }}>
                        II. CONTACT, RESIDENCE & VERIFIED GOVERNMENT IDENTIFICATIONS (STEP 2)
                      </div>
                      <div style={{ padding: '6px 8px', fontSize: '7.5pt', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                        <div>
                          <span style={{ fontSize: '6.5pt', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Mobile Phone</span>
                          <strong>{b.contactNumber || `${s2.countryCode || '+63'} ${s2.mobileNumber || ''}`}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '6.5pt', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Registered Email</span>
                          <span style={{ fontFamily: 'monospace' }}>{b.borrowerEmail || s2.email || 'borrower@tribute.ph'}</span>
                        </div>
                        <div style={{ gridColumn: 'span 2' }}>
                          <span style={{ fontSize: '6.5pt', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Permanent Residence Address</span>
                          <strong>{b.location || `${s2.addressLine1 || ''}, ${s2.barangay || ''}, ${s2.city || ''}, ${s2.province || ''}`}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '6.5pt', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Ownership & Length of Stay</span>
                          <strong>{s2.residenceOwnership || 'Owned'} ({s2.yearsOfResidence || '3'} Years)</strong>
                        </div>
                        <div style={{ gridColumn: 'span 3' }}>
                          <span style={{ fontSize: '6.5pt', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Government-Issued IDs</span>
                          {p.govIds && p.govIds.length > 0 ? (
                            <span>{p.govIds.map((id: any) => `${id.idType}: ${id.idNumber}${id.expiryDate ? ` (Exp: ${id.expiryDate})` : ''}`).join(' • ')}</span>
                          ) : (
                            <span>Philippine National ID (PhilSys) Verified</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Section 3: Dependants */}
                    {p.dependants && p.dependants.length > 0 && (
                      <div style={{ border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'hidden', marginBottom: '10px' }}>
                        <div style={{ backgroundColor: '#f1f5f9', padding: '4px 8px', borderBottom: '1px solid #cbd5e1', fontSize: '7.5pt', fontWeight: '800', color: '#1e293b', textTransform: 'uppercase' }}>
                          III. REGISTERED HOUSEHOLD DEPENDANTS (STEP 3)
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7pt' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #cbd5e1', textAlign: 'left' }}>
                              <th style={{ padding: '3px 6px' }}>Full Name</th>
                              <th style={{ padding: '3px 6px' }}>Relationship</th>
                              <th style={{ padding: '3px 6px' }}>Date of Birth</th>
                              <th style={{ padding: '3px 6px' }}>Schooling / Dependent Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {p.dependants.map((dep: any, dIdx: number) => (
                              <tr key={dIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '3px 6px', fontWeight: '700' }}>{dep.firstName} {dep.middleName} {dep.lastName}</td>
                                <td style={{ padding: '3px 6px' }}>{dep.relation}</td>
                                <td style={{ padding: '3px 6px' }}>{dep.dateOfBirth || 'N/A'}</td>
                                <td style={{ padding: '3px 6px' }}>{dep.isSchooling ? 'Currently Schooling' : 'Dependent'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Section 4: Livelihood, Cash Flow, Assets & Liabilities */}
                    <div style={{ border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'hidden', marginBottom: '10px' }}>
                      <div style={{ backgroundColor: '#f1f5f9', padding: '4px 8px', borderBottom: '1px solid #cbd5e1', fontSize: '7.5pt', fontWeight: '800', color: '#1e293b', textTransform: 'uppercase' }}>
                        IV. LIVELIHOOD, CASH FLOW, DECLARED ASSETS & LIABILITIES (STEP 4)
                      </div>
                      <div style={{ padding: '6px 8px', fontSize: '7.5pt', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', borderBottom: '1px dashed #e2e8f0' }}>
                        <div>
                          <span style={{ fontSize: '6.5pt', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Primary Occupation / Business</span>
                          <strong>{b.livelihood || s4.occupation || 'Micro-Enterprise'}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '6.5pt', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Trade Name / Employer</span>
                          <strong>{s4.employerEnterpriseName || 'Enterprise'}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '6.5pt', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Years in Operation</span>
                          <strong>{b.yearsInBusiness || s4.yearsInLivelihood || 3} Years</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '6.5pt', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Monthly Net Income</span>
                          <strong style={{ color: '#15803d' }}>₱ {(b.monthlyNetIncome || s4.monthlyNetIncome || 25000).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '6.5pt', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Net Disposable Cash Flow</span>
                          <strong>₱ {(b.netDisposableIncome || 18000).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '6.5pt', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Monthly Debt Obligations</span>
                          <strong style={{ color: '#b91c1c' }}>₱ {(b.existingDebts || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '6.5pt', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Assets Declared</span>
                          <strong>{p.assets && p.assets.length > 0 ? `${p.assets.length} Item(s)` : 'Household / Chattel Equity'}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '6.5pt', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Liabilities Tracked</span>
                          <strong>{p.liabilities && p.liabilities.length > 0 ? `${p.liabilities.length} Creditor Record(s)` : 'None'}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Section 5: Approved Loan Terms & 5 Cs Evaluation */}
                    <div style={{ border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'hidden', marginBottom: '10px' }}>
                      <div style={{ backgroundColor: '#f1f5f9', padding: '4px 8px', borderBottom: '1px solid #cbd5e1', fontSize: '7.5pt', fontWeight: '800', color: '#1e293b', textTransform: 'uppercase' }}>
                        V. APPROVED CREDIT TERMS, DISBURSEMENT & 5 Cs EVALUATION (STEPS 5 & 6)
                      </div>
                      <div style={{ padding: '6px 8px', fontSize: '7.5pt', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', borderBottom: '1px dashed #e2e8f0' }}>
                        <div>
                          <span style={{ fontSize: '6.5pt', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Approved Principal Loan</span>
                          <strong style={{ fontSize: '8pt', color: '#0f172a' }}>₱ {principal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '6.5pt', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Product & Term</span>
                          <strong>{b.productName} ({b.termMonths} Months)</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '6.5pt', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Repayment Mode & Installment</span>
                          <strong>₱ {calc.installmentPerFrequency.toLocaleString('en-PH', { minimumFractionDigits: 2 })} / {b.paymentMode.toLowerCase()}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '6.5pt', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>CBU / Collateral Retention</span>
                          <strong style={{ color: '#15803d' }}>₱ {calc.cbuAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '6.5pt', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Disbursement Channel</span>
                          <strong>{b.disbursementMode === 'cash' ? 'Cashier Window Cash' : `Online (${b.disbursementChannel || 'Bank/Wallet'})`}</strong>
                        </div>
                        <div style={{ gridColumn: 'span 2' }}>
                          <span style={{ fontSize: '6.5pt', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Disbursement Target Account / Ref</span>
                          <span style={{ fontFamily: 'monospace' }}>{b.disbursementAccountNumber || 'Over-the-Counter In-Branch'}</span>
                        </div>
                        <div>
                          <span style={{ fontSize: '6.5pt', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>5 Cs Credit Risk Rating</span>
                          <strong style={{ color: '#047857' }}>{b.fiveCs?.riskGrade || b.aiRiskRating || 'Class A (Low Risk)'}</strong>
                        </div>
                      </div>
                      {b.officerNotes && (
                        <div style={{ padding: '5px 8px', fontSize: '7pt', backgroundColor: '#fafafa' }}>
                          <span style={{ fontSize: '6.5pt', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: '700' }}>Account Officer Intake & CI Assessment Remarks:</span>
                          <p style={{ margin: '2px 0 0 0', fontStyle: 'italic' }}>{b.officerNotes}</p>
                        </div>
                      )}
                    </div>

                    {/* Section 6: Biometrics, Digital Signatures & Officer Attestation */}
                    <div style={{ border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ backgroundColor: '#f1f5f9', padding: '4px 8px', borderBottom: '1px solid #cbd5e1', fontSize: '7.5pt', fontWeight: '800', color: '#1e293b', textTransform: 'uppercase' }}>
                        VI. BIOMETRICS, DIGITAL SIGNATURES & OFFICIAL CONFORME (STEP 7)
                      </div>
                      <div style={{ padding: '8px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr', gap: '14px', alignItems: 'center' }}>
                        <div style={{ textAlign: 'center' }}>
                          <span style={{ fontSize: '6.5pt', color: '#64748b', display: 'block', textTransform: 'uppercase', marginBottom: '4px', fontWeight: '700' }}>Borrower Digital Stylus Signature</span>
                          <div style={{ height: '45px', border: '1px solid #cbd5e1', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' }}>
                            {b.applicantSignature ? (
                              <img src={b.applicantSignature} alt="Borrower Signature" style={{ maxHeight: '40px' }} />
                            ) : (
                              <span style={{ fontSize: '7pt', fontWeight: '700' }}>{b.borrowerName}</span>
                            )}
                          </div>
                          <p style={{ fontSize: '6.5pt', fontWeight: '800', margin: '3px 0 0 0', textTransform: 'uppercase' }}>{b.borrowerName}</p>
                          <span style={{ fontSize: '6pt', color: '#64748b' }}>Member-Borrower</span>
                        </div>

                        <div style={{ textAlign: 'center' }}>
                          <span style={{ fontSize: '6.5pt', color: '#64748b', display: 'block', textTransform: 'uppercase', marginBottom: '4px', fontWeight: '700' }}>Live Biometric Face Capture</span>
                          <div style={{ height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {b.applicantFacePhoto ? (
                              <img src={b.applicantFacePhoto} alt="Live Face Photo" style={{ height: '45px', borderRadius: '3px', border: '1px solid #cbd5e1' }} />
                            ) : (
                              <span style={{ fontSize: '6.5pt', color: '#15803d', fontWeight: '700' }}>✓ Biometric Verified</span>
                            )}
                          </div>
                          <p style={{ fontSize: '6.5pt', fontWeight: '800', color: '#15803d', margin: '3px 0 0 0' }}>VERIFIED & RECORDED</p>
                          <span style={{ fontSize: '6pt', color: '#64748b' }}>Biometric ID Check</span>
                        </div>

                        <div style={{ textAlign: 'center', borderLeft: '1px solid #e2e8f0', paddingLeft: '12px' }}>
                          <span style={{ fontSize: '6.5pt', color: '#64748b', display: 'block', textTransform: 'uppercase', marginBottom: '4px', fontWeight: '700' }}>Account Officer Certification</span>
                          <div style={{ height: '45px', borderBottom: '1px solid #0f172a', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: '3px' }}>
                            <span style={{ fontSize: '7.5pt', fontWeight: '800', fontFamily: 'monospace' }}>Officer Juan (AO-001)</span>
                          </div>
                          <p style={{ fontSize: '6.5pt', fontWeight: '800', margin: '3px 0 0 0', textTransform: 'uppercase' }}>OFFICER JUAN DE LA CRUZ</p>
                          <span style={{ fontSize: '6pt', color: '#64748b' }}>Account Officer / Credit Committee Investigator</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })()}

        {/* ============================================================== */}
        {/* INTERACTIVE PASSBOOK MODAL (SCREEN PREVIEW & DEDICATED PRINT)  */}
        {/* ============================================================== */}
        {passbookModalBorrower && (() => {
          const b = passbookModalBorrower;
          const principal = b.finalContractAmount || b.adminApprovedAmount || b.requestedAmount;
          const isRenewal = (b.loanCycle || 1) > 1;
          const calc = calculateTributeLoan(principal, b.termMonths, b.productName, b.paymentMode, isRenewal);
          const cbuInitial = calc.cbuAmount;
          const releaseDate = b.disbursedAt 
            ? new Date(b.disbursedAt).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
            : new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });

          const aoSig = b.evaluatedByOfficer ? `${b.evaluatedByOfficer.replace(/\s+/g, '_').toUpperCase()}-AUTH0012220-A` : 'ROLANDO_ROBLES-AUTH0012220-A';
          const mgrSig = 'DENNIS_YUAN-AUTH0002912-C';

          // Extract biometrics & signatures with fallbacks across fullProfile and Step 1/7
          const p: any = b.fullProfile || {};
          const s1: any = p.step1 || {};
          const facePhoto = b.applicantFacePhoto || p.applicantFacePhoto || s1.applicantFacePhoto;
          const holdingPhoto = b.borrowerHoldingIdPhoto || p.borrowerHoldingIdPhoto;
          const borrowerSigs = (b.borrowerSignatures && b.borrowerSignatures.length > 0)
            ? b.borrowerSignatures
            : (p.borrowerSignatures && p.borrowerSignatures.length > 0)
            ? p.borrowerSignatures
            : (b.applicantSignature || p.applicantSignature)
            ? [
                { signature: b.applicantSignature || p.applicantSignature, authId: 'AUTH-BRW-001-S1', timestamp: b.evaluatedAt || 'Nov 5, 2026 07:24 PM' },
                { signature: b.applicantSignature || p.applicantSignature, authId: 'AUTH-BRW-001-S2', timestamp: b.evaluatedAt || 'Nov 5, 2026 07:25 PM' },
                { signature: b.applicantSignature || p.applicantSignature, authId: 'AUTH-BRW-001-S3', timestamp: b.evaluatedAt || 'Nov 5, 2026 07:26 PM' },
              ]
            : undefined;
          const primarySig = b.applicantSignature || p.applicantSignature || (borrowerSigs && borrowerSigs[0]?.signature);
          const aoSigs = (b.officerSignatures && b.officerSignatures.length > 0)
            ? b.officerSignatures
            : (p.officerSignatures && p.officerSignatures.length > 0)
            ? p.officerSignatures
            : undefined;

          // Generate collection schedule according to Philippine holiday calendar & payment mode
          const parsedApprovalDate = b.disbursedAt ? new Date(b.disbursedAt) : new Date();
          const baseApprovalDate = isNaN(parsedApprovalDate.getTime()) ? new Date() : parsedApprovalDate;
          const officialSched = generateCollectionScheduleDates(
            baseApprovalDate,
            b.termMonths || 3,
            b.paymentMode || 'Weekly'
          );

          const samplePayments = (b.paymentLedgerRecords && b.paymentLedgerRecords.length > 0)
            ? b.paymentLedgerRecords
            : officialSched.map((item, sIdx) => {
                const interestPerInst = Math.round(calc.totalInterest / calc.numberOfInstallments);
                return {
                  installmentNo: item.installmentNo,
                  paymentSchedule: item.dateStr,
                  status: 'Pending' as const,
                  principalAmount: principal,
                  interest: interestPerInst,
                };
              });

          const currentCbuBalance = b.savingsBalance !== undefined ? b.savingsBalance : cbuInitial;

          const sampleCbu = (b.savingsLedgerRecords && b.savingsLedgerRecords.length > 0)
            ? [
                {
                  paymentSchedule: releaseDate,
                  datePaid: releaseDate,
                  cbuIn: cbuInitial,
                  cbuOut: 0,
                  cbuBalance: cbuInitial,
                  aoSignature: aoSig.replace('AUTH0012220-A', 'AUTH0012222-A')
                },
                ...b.savingsLedgerRecords.map(s => ({
                  paymentSchedule: s.notes || (s.type === 'deposit' ? 'Member Deposit' : 'Member Withdrawal'),
                  datePaid: s.date,
                  cbuIn: s.type === 'deposit' ? s.amount : 0,
                  cbuOut: s.type === 'withdraw' ? s.amount : 0,
                  cbuBalance: s.runningBalance,
                  aoSignature: (b.evaluatedByOfficer ? b.evaluatedByOfficer.replace(/\s+/g, '_').toUpperCase() : 'OFFICER_JUAN') + '-' + (s.referenceNo || 'REF-SAV')
                }))
              ]
            : [
                {
                  paymentSchedule: releaseDate,
                  datePaid: releaseDate,
                  cbuIn: cbuInitial,
                  cbuOut: 0,
                  cbuBalance: cbuInitial,
                  aoSignature: aoSig.replace('AUTH0012220-A', 'AUTH0012222-A')
                }
              ];

          const passbookData: PassbookData = {
            borrowerName: b.borrowerName,
            cidNumber: b.cidNumber || b.mcid || s1.cooperativeId || b.policyNo || 'TCID-A-00001',
            loanReference: b.applicationId || 'TC-LN-A-00001',
            mcidNumber: b.mcid || b.cidNumber || s1.cooperativeId || 'TCID-A-00001',
            spouseName: b.spouseName || 'N/A',
            permanentAddress: b.location,
            membershipDate: b.membershipDate || releaseDate,
            dateIssued: releaseDate,
            issuedByName: b.evaluatedByOfficer || 'OFFICER JUAN DE LA CRUZ',
            issuedByDesignation: 'Account Officer (AO-001)',
            specimenSignature: primarySig,
            specimenSignatures: borrowerSigs,
            aoSignatures: aoSigs,
            memberFacePhoto: facePhoto,
            holdingIdPhoto: holdingPhoto,
            dateReleased: releaseDate,
            loanType: b.productName.replace(' Loan', ''),
            loanAmount: principal,
            termMonths: b.termMonths || 3,
            paymentMode: b.paymentMode || 'Weekly',
            disbursementType: b.disbursementMode === 'cash' ? 'Cash' : (b.disbursementChannel || 'Cash'),
            cycle: b.loanCycle || 1,
            aoSignatureName: aoSig,
            managerSignatureName: mgrSig,
            cbuInitialDeposit: cbuInitial,
            cbuBalance: currentCbuBalance,
            paymentRecords: samplePayments,
            cbuRecords: sampleCbu
          };

          return (
            <div className={`no-print ${styles.modalBackdrop}`}>
              <div className={`${styles.modalDialog} ${styles.modalDialogPassbook}`}>
                {/* Modal Top Header */}
                <div className={styles.modalHeader}>
                  <div className={styles.modalHeaderTitleGroup}>
                    <div className={styles.modalHeaderIcon}>
                      <BookOpen size={20} color="#15803d" />
                    </div>
                    <div>
                      <h3 className={styles.modalTitle}>
                        Official Passbook & Microfinance Statement
                      </h3>
                      <span className={styles.modalSubtitle}>
                        {b.borrowerName} &bull; CID: <strong style={{ color: '#15803d', fontFamily: 'monospace' }}>{b.mcid || b.cidNumber || b.policyNo}</strong> &bull; Complete Unified Record
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setPassbookModalBorrower(null);
                        setLedgerModalBorrower(b);
                      }}
                      className={styles.btnSavings}
                      style={{ padding: '8px 14px', fontSize: '12px' }}
                      title="View & Print Standalone Loan Payment Ledger (Field Copy)"
                    >
                      <FileSpreadsheet size={14} /> View / Print Payment Ledger
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handlePrintDocument('passbook', b);
                      }}
                      className={styles.btnConfirm}
                      style={{ padding: '8px 16px', fontSize: '12px' }}
                    >
                      <Printer size={14} /> Print Official Passbook
                    </button>
                    <button
                      type="button"
                      onClick={() => setPassbookModalBorrower(null)}
                      className={styles.modalCloseBtn}
                      aria-label="Close passbook"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>

                {/* Modal Scrollable Body - Single Unified Document */}
                <div className={styles.modalPassbookBody}>
                  <PassbookBooklet data={passbookData} />
                </div>
              </div>
            </div>
          );
        })()}

        {/* ============================================================== */}
        {/* INTERACTIVE PAYMENT LEDGER MODAL (SCREEN PREVIEW & PRINT)      */}
        {/* ============================================================== */}
        {ledgerModalBorrower && (() => {
          const b = ledgerModalBorrower;
          const principal = b.finalContractAmount || b.adminApprovedAmount || b.requestedAmount;
          const isRenewal = (b.loanCycle || 1) > 1;
          const calc = calculateTributeLoan(principal, b.termMonths, b.productName, b.paymentMode, isRenewal);
          const cbuInitial = calc.cbuAmount;
          const releaseDate = b.disbursedAt 
            ? new Date(b.disbursedAt).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
            : new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });

          const aoSig = b.evaluatedByOfficer ? `${b.evaluatedByOfficer.replace(/\s+/g, '_').toUpperCase()}-AUTH0012220-A` : 'ROLANDO_ROBLES-AUTH0012220-A';
          const mgrSig = 'DENNIS_YUAN-AUTH0002912-C';

          const p: any = b.fullProfile || {};
          const s1: any = p.step1 || {};
          const facePhoto = b.applicantFacePhoto || p.applicantFacePhoto || s1.applicantFacePhoto;
          const holdingPhoto = b.borrowerHoldingIdPhoto || p.borrowerHoldingIdPhoto;
          const borrowerSigs = (b.borrowerSignatures && b.borrowerSignatures.length > 0)
            ? b.borrowerSignatures
            : (p.borrowerSignatures && p.borrowerSignatures.length > 0)
            ? p.borrowerSignatures
            : (b.applicantSignature || p.applicantSignature)
            ? [
                { signature: b.applicantSignature || p.applicantSignature, authId: 'AUTH-BRW-001-S1', timestamp: b.evaluatedAt || 'Nov 5, 2026 07:24 PM' },
                { signature: b.applicantSignature || p.applicantSignature, authId: 'AUTH-BRW-001-S2', timestamp: b.evaluatedAt || 'Nov 5, 2026 07:25 PM' },
                { signature: b.applicantSignature || p.applicantSignature, authId: 'AUTH-BRW-001-S3', timestamp: b.evaluatedAt || 'Nov 5, 2026 07:26 PM' },
              ]
            : undefined;
          const primarySig = b.applicantSignature || p.applicantSignature || (borrowerSigs && borrowerSigs[0]?.signature);
          const aoSigs = (b.officerSignatures && b.officerSignatures.length > 0)
            ? b.officerSignatures
            : (p.officerSignatures && p.officerSignatures.length > 0)
            ? p.officerSignatures
            : undefined;

          const parsedApprovalDate = b.disbursedAt ? new Date(b.disbursedAt) : new Date();
          const baseApprovalDate = isNaN(parsedApprovalDate.getTime()) ? new Date() : parsedApprovalDate;
          const officialSched = generateCollectionScheduleDates(
            baseApprovalDate,
            b.termMonths || 3,
            b.paymentMode || 'Weekly'
          );

          const samplePayments = (b.paymentLedgerRecords && b.paymentLedgerRecords.length > 0)
            ? b.paymentLedgerRecords
            : officialSched.map((item) => {
                const interestPerInst = Math.round(calc.totalInterest / calc.numberOfInstallments);
                return {
                  installmentNo: item.installmentNo,
                  paymentSchedule: item.dateStr,
                  status: 'Pending' as const,
                  principalAmount: principal,
                  interest: interestPerInst,
                };
              });

          const currentCbuBalance = b.savingsBalance !== undefined ? b.savingsBalance : cbuInitial;

          const sampleCbu = (b.savingsLedgerRecords && b.savingsLedgerRecords.length > 0)
            ? [
                {
                  paymentSchedule: releaseDate,
                  datePaid: releaseDate,
                  cbuIn: cbuInitial,
                  cbuOut: 0,
                  cbuBalance: cbuInitial,
                  aoSignature: aoSig.replace('AUTH0012220-A', 'AUTH0012222-A')
                },
                ...b.savingsLedgerRecords.map(s => ({
                  paymentSchedule: s.notes || (s.type === 'deposit' ? 'Member Deposit' : 'Member Withdrawal'),
                  datePaid: s.date,
                  cbuIn: s.type === 'deposit' ? s.amount : 0,
                  cbuOut: s.type === 'withdraw' ? s.amount : 0,
                  cbuBalance: s.runningBalance,
                  aoSignature: (b.evaluatedByOfficer ? b.evaluatedByOfficer.replace(/\s+/g, '_').toUpperCase() : 'OFFICER_JUAN') + '-' + (s.referenceNo || 'REF-SAV')
                }))
              ]
            : [
                {
                  paymentSchedule: releaseDate,
                  datePaid: releaseDate,
                  cbuIn: cbuInitial,
                  cbuOut: 0,
                  cbuBalance: cbuInitial,
                  aoSignature: aoSig.replace('AUTH0012220-A', 'AUTH0012222-A')
                }
              ];

          const passbookData: PassbookData = {
            borrowerName: b.borrowerName,
            cidNumber: b.cidNumber || b.mcid || s1.cooperativeId || b.policyNo || 'TCID-A-00001',
            loanReference: b.applicationId || 'TC-LN-A-00001',
            mcidNumber: b.mcid || b.cidNumber || s1.cooperativeId || 'TCID-A-00001',
            spouseName: b.spouseName || 'N/A',
            permanentAddress: b.location,
            membershipDate: b.membershipDate || releaseDate,
            dateIssued: releaseDate,
            issuedByName: b.evaluatedByOfficer || 'OFFICER JUAN DE LA CRUZ',
            issuedByDesignation: 'Account Officer (AO-001)',
            specimenSignature: primarySig,
            specimenSignatures: borrowerSigs,
            aoSignatures: aoSigs,
            memberFacePhoto: facePhoto,
            holdingIdPhoto: holdingPhoto,
            dateReleased: releaseDate,
            loanType: b.productName.replace(' Loan', ''),
            loanAmount: principal,
            termMonths: b.termMonths || 3,
            paymentMode: b.paymentMode || 'Weekly',
            disbursementType: b.disbursementMode === 'cash' ? 'Cash' : (b.disbursementChannel || 'Cash'),
            cycle: b.loanCycle || 1,
            aoSignatureName: aoSig,
            managerSignatureName: mgrSig,
            cbuInitialDeposit: cbuInitial,
            cbuBalance: currentCbuBalance,
            paymentRecords: samplePayments,
            cbuRecords: sampleCbu
          };

          return (
            <div className={`no-print ${styles.modalBackdrop}`}>
              <div className={`${styles.modalDialog} ${styles.modalDialogPassbook}`}>
                <div className={styles.modalHeader}>
                  <div className={styles.modalHeaderTitleGroup}>
                    <div className={styles.modalHeaderIcon}>
                      <FileSpreadsheet size={20} color="#15803d" />
                    </div>
                    <div>
                      <h3 className={styles.modalTitle}>
                        Official Loan Payment Ledger (Field Copy)
                      </h3>
                      <span className={styles.modalSubtitle}>
                        {b.borrowerName} &bull; Policy: <strong style={{ color: '#15803d', fontFamily: 'monospace' }}>{b.policyNo}</strong> &bull; Repayment Schedule & Payments
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setLedgerModalBorrower(null);
                        setPassbookModalBorrower(b);
                      }}
                      className={styles.btnSavings}
                      style={{ padding: '8px 14px', fontSize: '12px' }}
                      title="View & Print Full Passbook"
                    >
                      <BookOpen size={14} /> View Passbook
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePrintLedger(b)}
                      className={styles.btnConfirm}
                      style={{ padding: '8px 16px', fontSize: '12px' }}
                    >
                      <Printer size={14} /> Print Payment Ledger
                    </button>
                    <button
                      type="button"
                      onClick={() => setLedgerModalBorrower(null)}
                      className={styles.modalCloseBtn}
                      aria-label="Close ledger"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>

                <div className={styles.modalPassbookBody}>
                  <LoanPaymentLedger data={passbookData} />
                </div>
              </div>
            </div>
          );
        })()}

        {/* ============================================================== */}
        {/* INTERACTIVE BORROWER DETAILS MODAL (SCREEN & DOSSIER PRINT)   */}
        {/* ============================================================== */}
        {detailsModalBorrower && (() => {
          const b = detailsModalBorrower;
          const principal = b.finalContractAmount || b.adminApprovedAmount || b.requestedAmount;
          const isRenewal = (b.loanCycle || 1) > 1;
          const calc = calculateTributeLoan(principal, b.termMonths, b.productName, b.paymentMode, isRenewal);
          const p: any = b.fullProfile || {};
          const s1: any = p.step1 || {};
          const s2: any = p.step2 || {};
          const s3: any = p.step3 || {};
          const s4: any = p.step4 || {};
          const s5: any = p.step5 || {};
          const mcid = b.mcid || b.cidNumber || s1.cooperativeId || 'TCID-A-00001';
          const facePhoto = b.applicantFacePhoto || p.applicantFacePhoto || s1.applicantFacePhoto;

          return (
            <div className={`no-print ${styles.modalBackdrop}`}>
              <div className={`${styles.modalDialog} ${styles.modalDialogPassbook}`}>
                <div className={styles.modalHeader}>
                  <div className={styles.modalHeaderTitleGroup}>
                    <div className={styles.modalHeaderIcon}>
                      <Eye size={20} color="#15803d" />
                    </div>
                    <div>
                      <h3 className={styles.modalTitle}>
                        Borrower Dossier & Comprehensive Record
                      </h3>
                      <span className={styles.modalSubtitle}>
                        {b.borrowerName} &bull; MCID: <strong style={{ color: '#15803d', fontFamily: 'monospace' }}>{mcid}</strong> &bull; Policy: <strong style={{ color: '#15803d', fontFamily: 'monospace' }}>{b.policyNo}</strong>
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => handlePrintDocument('details', b)}
                      className={styles.btnConfirm}
                      style={{ padding: '8px 16px', fontSize: '12px' }}
                    >
                      <Printer size={14} /> Print Official Dossier
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetailsModalBorrower(null)}
                      className={styles.modalCloseBtn}
                      aria-label="Close details"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>

                <div className={styles.modalPassbookBody} style={{ padding: '20px' }}>
                  <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #dcece0', padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    
                    {/* Header Strip with Member Bio */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
                      {facePhoto ? (
                        <img
                          src={facePhoto}
                          alt={b.borrowerName}
                          style={{ width: '64px', height: '64px', borderRadius: '10px', objectFit: 'cover', border: '2px solid #86efac' }}
                        />
                      ) : (
                        <div style={{ width: '64px', height: '64px', borderRadius: '10px', backgroundColor: '#dcfce7', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: '800' }}>
                          {b.borrowerName.charAt(0)}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: '220px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <h4 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>{b.borrowerName}</h4>
                          <span style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '800' }}>
                            Cycle {b.loanCycle || 1}
                          </span>
                        </div>
                        <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                          {b.location || 'Commonwealth Ave, Quezon City'} &bull; {b.contactNumber || 'N/A'}
                        </p>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <span style={{ display: 'block', fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>Approved Principal</span>
                        <strong style={{ fontSize: '18px', color: '#15803d' }}>₱ {principal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong>
                      </div>
                    </div>

                    {/* Loan Terms Summary Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                      <div style={{ backgroundColor: '#f8fbf9', border: '1px solid #dcece0', borderRadius: '10px', padding: '12px' }}>
                        <span style={{ display: 'block', fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>Product & Term</span>
                        <strong style={{ fontSize: '14px', color: '#0f172a' }}>{b.productName} ({b.termMonths} Months)</strong>
                      </div>
                      <div style={{ backgroundColor: '#f8fbf9', border: '1px solid #dcece0', borderRadius: '10px', padding: '12px' }}>
                        <span style={{ display: 'block', fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>Payment Mode & Due</span>
                        <strong style={{ fontSize: '14px', color: '#0f172a' }}>₱ {calc.installmentPerFrequency.toLocaleString('en-PH', { minimumFractionDigits: 2 })} / {b.paymentMode.toLowerCase()}</strong>
                      </div>
                      <div style={{ backgroundColor: '#f8fbf9', border: '1px solid #dcece0', borderRadius: '10px', padding: '12px' }}>
                        <span style={{ display: 'block', fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>Total Contractual</span>
                        <strong style={{ fontSize: '14px', color: '#0f172a' }}>₱ {calc.contractualBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong>
                      </div>
                      <div style={{ backgroundColor: '#f8fbf9', border: '1px solid #dcece0', borderRadius: '10px', padding: '12px' }}>
                        <span style={{ display: 'block', fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>CBU / Retention</span>
                        <strong style={{ fontSize: '14px', color: '#15803d' }}>₱ {calc.cbuAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong>
                      </div>
                    </div>

                    {/* Member & Business Background */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
                      <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px' }}>
                        <h5 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>Personal & Demographic Info</h5>
                        <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div><span style={{ color: '#64748b' }}>Date of Birth:</span> <strong>{s1.birthDate || (b as any).birthDate || 'N/A'}</strong></div>
                          <div><span style={{ color: '#64748b' }}>Civil Status:</span> <strong>{s1.civilStatus || (b as any).civilStatus || 'Married'}</strong></div>
                          <div><span style={{ color: '#64748b' }}>Spouse Name:</span> <strong>{b.spouseName || s1.spouseName || 'N/A'}</strong></div>
                          <div><span style={{ color: '#64748b' }}>Valid ID / Reg:</span> <strong>{s1.idType || 'PhilSys National ID'} ({s1.idNumber || 'N/A'})</strong></div>
                        </div>
                      </div>

                      <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px' }}>
                        <h5 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>Business & Income Activity</h5>
                        <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div><span style={{ color: '#64748b' }}>Business Name:</span> <strong>{s2.businessName || (b as any).businessName || 'Micro Retail Enterprise'}</strong></div>
                          <div><span style={{ color: '#64748b' }}>Type of Business:</span> <strong>{s2.businessType || (b as any).businessType || 'Sari-sari Store / Retail'}</strong></div>
                          <div><span style={{ color: '#64748b' }}>Years in Operation:</span> <strong>{s2.yearsInBusiness || (b as any).yearsInBusiness || '3'} years</strong></div>
                          <div><span style={{ color: '#64748b' }}>Estimated Monthly Net:</span> <strong style={{ color: '#15803d' }}>₱ {(b.monthlyNetIncome || s2.monthlyNetIncome || 25000).toLocaleString('en-PH')}</strong></div>
                        </div>
                      </div>

                      <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px' }}>
                        <h5 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>Co-Maker / Guarantor Info</h5>
                        <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div><span style={{ color: '#64748b' }}>Co-Maker Name:</span> <strong>{s4.coMakerName || (b as any).coMakerName || 'Elena Santos'}</strong></div>
                          <div><span style={{ color: '#64748b' }}>Relationship:</span> <strong>{s4.coMakerRelationship || (b as any).coMakerRelationship || 'Sister / Neighbor'}</strong></div>
                          <div><span style={{ color: '#64748b' }}>Co-Maker Contact:</span> <strong>{s4.coMakerContact || (b as any).coMakerContact || '0917-889-4412'}</strong></div>
                          <div><span style={{ color: '#64748b' }}>Co-Maker Source of Income:</span> <strong>{s4.coMakerIncomeSource || (b as any).coMakerIncomeSource || 'Employed / Self-Employed'}</strong></div>
                        </div>
                      </div>
                    </div>

                    {/* CI & Risk Notes */}
                    <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px' }}>
                      <h5 style={{ margin: '0 0 6px 0', fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>Underwriting & CI Notes</h5>
                      <p style={{ margin: 0, fontSize: '12px', color: '#475569', fontStyle: 'italic' }}>
                        {b.officerNotes || 'Borrower underwent complete Credit Investigation, character reference verification, and capacity evaluation. Verified member in good standing with positive neighborhood repayment standing.'}
                      </p>
                    </div>

                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ============================================================== */}
        {/* PAY LOAN / COLLECTION MODAL                                    */}
        {/* ============================================================== */}
        {payLoanModalBorrower && (() => {
          const b = payLoanModalBorrower;
          const principal = b.finalContractAmount || b.adminApprovedAmount || b.requestedAmount;
          const calc = calculateTributeLoan(principal, b.termMonths, b.productName, b.paymentMode);
          const contractualBalance = calc.contractualBalance;
          const totalPaidSoFar = b.totalCollected || 0;
          const currentRemainingBalance = b.remainingBalance !== undefined ? b.remainingBalance : Math.max(0, contractualBalance - totalPaidSoFar);

          // Get next unpaid installment from official schedule or ledger
          const baseApprovalDate = b.disbursedAt ? new Date(b.disbursedAt) : new Date();
          const officialSched = generateCollectionScheduleDates(
            isNaN(baseApprovalDate.getTime()) ? new Date() : baseApprovalDate,
            b.termMonths || 3,
            b.paymentMode || 'Weekly'
          );

          const currentSchedule = (b.paymentLedgerRecords && b.paymentLedgerRecords.length > 0)
            ? b.paymentLedgerRecords
            : officialSched.map((item) => ({
                installmentNo: item.installmentNo,
                paymentSchedule: item.dateStr,
                status: 'Pending' as const,
                principalAmount: principal,
                interest: Math.round(calc.totalInterest / calc.numberOfInstallments),
                payment: calc.installmentPerFrequency,
                loanBalance: contractualBalance
              }));

          const nextPendingInst = currentSchedule.find(s => s.status !== 'Paid') || currentSchedule[currentSchedule.length - 1];

          const handleProcessPayment = () => {
            if (paymentAmount <= 0) {
              alert('Please enter a valid payment amount.');
              return;
            }

            if (!paymentAoSignature) {
              alert('Account Officer digital signature is strictly required to verify and authorize this loan repayment collection.');
              return;
            }

            setIsSubmittingPayment(true);
            const now = new Date();
            const dateStr = now.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
            const authId = `AUTH-COL-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;
            const officerName = b.evaluatedByOfficer || 'Officer Juan (AO-001)';

            const newTotalCollected = totalPaidSoFar + paymentAmount;
            const newRemaining = Math.max(0, contractualBalance - newTotalCollected);

            // Update installment record in schedule
            let updatedSchedule = [...currentSchedule];
            const targetIdx = updatedSchedule.findIndex(s => s.status !== 'Paid');
            if (targetIdx >= 0) {
              updatedSchedule[targetIdx] = {
                ...updatedSchedule[targetIdx],
                status: 'Paid',
                datePaid: dateStr,
                payment: paymentAmount,
                loanBalance: newRemaining,
                aoSignature: `${officerName.replace(/\s+/g, '_').toUpperCase()}-${authId.slice(-8)}`,
                aoSignatureImage: paymentAoSignature,
                authId: authId,
                paymentMethod: paymentMethod,
                notes: paymentNotes
              };

              // If loan balance reaches 0 (100% paid / early settlement), update all remaining future installments to Settled
              if (newRemaining <= 0) {
                for (let k = targetIdx + 1; k < updatedSchedule.length; k++) {
                  if (updatedSchedule[k].status !== 'Paid') {
                    updatedSchedule[k] = {
                      ...updatedSchedule[k],
                      status: 'Settled',
                      loanBalance: 0,
                      notes: `Loan 100% settled via early payment on installment #${targetIdx + 1}`
                    };
                  }
                }
              }
            }

            const updatedBorrower: CreditAssessmentItem = {
              ...b,
              totalCollected: newTotalCollected,
              remainingBalance: newRemaining,
              paymentLedgerRecords: updatedSchedule
            };

            saveCreditAssessment(updatedBorrower);

            // Update local state list
            setBorrowers(prev => prev.map(item => item.id === b.id ? updatedBorrower : item));
            setPayLoanModalBorrower(updatedBorrower);
            setIsSubmittingPayment(false);
            setPaymentSuccessMsg(`Payment of ₱${paymentAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })} successfully recorded with Auth ID: ${authId}!`);
          };

          return (
            <div className={`no-print ${styles.modalBackdrop}`}>
              <div className={styles.modalDialog}>
                {/* Header */}
                <div className={styles.modalHeader}>
                  <div className={styles.modalHeaderTitleGroup}>
                    <div className={styles.modalHeaderIcon}>
                      <CreditCard size={20} color="#15803d" />
                    </div>
                    <div>
                      <h3 className={styles.modalTitle}>
                        Pay Loan Installment
                      </h3>
                      <span className={styles.modalSubtitle}>
                        {b.borrowerName} &bull; Loan Ref: {b.applicationId || 'TC-LN-A-00001'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPayLoanModalBorrower(null)}
                    className={styles.modalCloseBtn}
                    aria-label="Close pay loan"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Content */}
                <div className={styles.modalBody}>
                  {paymentSuccessMsg ? (
                    <div style={{ textAlign: 'center', padding: '16px 8px' }}>
                      <div style={{ width: '48px', height: '48px', backgroundColor: '#dcfce7', borderRadius: '50%', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                        <CheckCircle size={28} />
                      </div>
                      <h4 style={{ fontSize: '16px', fontWeight: '800', color: '#15803d', margin: '0 0 6px 0' }}>
                        Collection Recorded!
                      </h4>
                      <p style={{ fontSize: '12.5px', color: '#334155', margin: '0 0 16px 0' }}>
                        {paymentSuccessMsg}
                      </p>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setPayLoanModalBorrower(null);
                            handleOpenPassbookModal(b);
                          }}
                          className={styles.btnConfirm}
                        >
                          View in Passbook
                        </button>
                        <button
                          type="button"
                          onClick={() => setPayLoanModalBorrower(null)}
                          className={styles.btnCancel}
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {/* Summary Cards */}
                      <div className={styles.modalSummaryGrid}>
                        <div className={styles.modalSummaryBox}>
                          <span className={styles.modalSummaryLabel}>Regular Due</span>
                          <strong style={{ fontSize: '13px', color: '#15803d' }}>
                            ₱ {calc.installmentPerFrequency.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </strong>
                        </div>
                        <div className={styles.modalSummaryBox}>
                          <span className={styles.modalSummaryLabel}>Total Paid</span>
                          <strong style={{ fontSize: '13px', color: '#047857' }}>
                            ₱ {totalPaidSoFar.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </strong>
                        </div>
                        <div className={styles.modalSummaryBox}>
                          <span className={styles.modalSummaryLabel}>Remaining</span>
                          <strong style={{ fontSize: '13px', color: '#dc2626' }}>
                            ₱ {currentRemainingBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </strong>
                        </div>
                      </div>

                      {/* Payment Schedule Target Info */}
                      <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '8px 12px', borderRadius: '8px', marginBottom: '14px', fontSize: '11.5px', color: '#166534', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Target: <strong>Inst #{nextPendingInst?.installmentNo || 1}</strong> ({nextPendingInst?.paymentSchedule || 'Upcoming Due'})</span>
                        <span style={{ fontSize: '10.5px', backgroundColor: '#dcfce7', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>{b.paymentMode} Mode</span>
                      </div>

                      {/* Form Fields */}
                      <div className={styles.modalFieldGroup}>
                        <label className={styles.modalLabel}>
                          Payment Amount (₱)
                        </label>
                        <input
                          type="number"
                          value={paymentAmount || ''}
                          onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                          className={styles.modalInputAmount}
                          placeholder="0.00"
                        />
                      </div>

                      <div className={styles.modalFieldGroup}>
                        <label className={styles.modalLabel}>
                          Payment Method
                        </label>
                        <select
                          value={paymentMethod}
                          onChange={(e: any) => setPaymentMethod(e.target.value)}
                          className={styles.modalInput}
                        >
                          <option value="cash">Cash (Field Officer Collection)</option>
                          <option value="gcash">GCash Transfer</option>
                          <option value="maya">Maya Transfer</option>
                          <option value="bank_transfer">Bank Transfer / Over-The-Counter</option>
                        </select>
                      </div>

                      <div style={{ marginBottom: '14px' }}>
                        <label className={styles.modalLabel}>
                          Collection Notes / Reference (Optional)
                        </label>
                        <input
                          type="text"
                          value={paymentNotes}
                          onChange={(e) => setPaymentNotes(e.target.value)}
                          className={styles.modalInput}
                          placeholder="e.g. Field visit, receipt no, or GCash ref"
                        />
                      </div>

                      {/* Required Account Officer Digital Signature Pad */}
                      <div className={`${styles.signatureBox} ${paymentAoSignature ? styles.signatureBoxCaptured : ''}`}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <label style={{ fontSize: '12px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                            <span className={styles.requiredBadge}>Required</span>
                            AO Authorization Signature (Field Verification)
                          </label>
                          <span style={{ fontSize: '11px', fontWeight: '700', color: paymentAoSignature ? '#16a34a' : '#dc2626' }}>
                            {paymentAoSignature ? '✓ Signature Captured' : '* Signature Required'}
                          </span>
                        </div>
                        <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', overflow: 'hidden' }}>
                          <SignaturePad
                            key={`pay-sig-${b.id}`}
                            onSave={(dataUrl) => setPaymentAoSignature(dataUrl)}
                            height={120}
                          />
                        </div>
                        <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
                          <span>Sign above using stylus or mouse as {b.evaluatedByOfficer || 'Officer Juan (AO-001)'}</span>
                          {paymentAoSignature && <span style={{ color: '#16a34a', fontWeight: '700' }}>✓ Verified</span>}
                        </div>
                      </div>

                      <div className={styles.modalFooter}>
                        <button
                          type="button"
                          onClick={() => setPayLoanModalBorrower(null)}
                          className={styles.btnCancel}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleProcessPayment}
                          disabled={isSubmittingPayment}
                          className={styles.btnConfirm}
                        >
                          <CheckCircle size={15} /> Confirm & Record Collection
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ============================================================== */}
        {/* DEPOSIT / WITHDRAW SAVINGS (CBU) MODAL                          */}
        {/* ============================================================== */}
        {savingsModalBorrower && (() => {
          const b = savingsModalBorrower;
          const principal = b.finalContractAmount || b.adminApprovedAmount || b.requestedAmount;
          const calc = calculateTributeLoan(principal, b.termMonths, b.productName, b.paymentMode);
          const initialCbu = calc.cbuAmount;
          const currentSavings = b.savingsBalance !== undefined ? b.savingsBalance : initialCbu;

          const handleProcessSavings = () => {
            if (savingsAmount <= 0) {
              alert('Please enter a valid amount.');
              return;
            }

            if (savingsActionType === 'withdraw') {
              // Enforce ₱500 floor
              if (currentSavings - savingsAmount < 500) {
                alert(`Withdrawal denied: CBU cannot go below the minimum floor of ₱500.00. (Current Balance: ₱${currentSavings.toLocaleString('en-PH', { minimumFractionDigits: 2 })}, Maximum Allowed Withdrawal: ₱${Math.max(0, currentSavings - 500).toLocaleString('en-PH', { minimumFractionDigits: 2 })})`);
                return;
              }
            }

            setIsSubmittingSavings(true);
            const now = new Date();
            const dateStr = now.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
            if (!savingsAoSignature) {
              alert('Account Officer digital signature is strictly required to verify and authorize this savings transaction.');
              setIsSubmittingSavings(false);
              return;
            }

            const refNo = `SAV-${savingsActionType === 'deposit' ? 'DEP' : 'WDL'}-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

            const newBalance = savingsActionType === 'deposit'
              ? currentSavings + savingsAmount
              : currentSavings - savingsAmount;

            const officerName = b.evaluatedByOfficer || 'Officer Juan (AO-001)';
            const newEntry = {
              id: refNo,
              date: dateStr,
              type: savingsActionType,
              amount: savingsAmount,
              runningBalance: newBalance,
              referenceNo: refNo,
              processedBy: officerName,
              aoSignature: `${officerName.replace(/\s+/g, '_').toUpperCase()}-${refNo.slice(-8)}`,
              aoSignatureImage: savingsAoSignature,
              notes: savingsNotes || (savingsActionType === 'deposit' ? `Member Savings Deposit via ${savingsMethod}` : `Member CBU Withdrawal via ${savingsMethod}`)
            };

            const updatedSavingsHistory = b.savingsLedgerRecords ? [...b.savingsLedgerRecords, newEntry] : [newEntry];

            const updatedBorrower: CreditAssessmentItem = {
              ...b,
              savingsBalance: newBalance,
              savingsLedgerRecords: updatedSavingsHistory
            };

            saveCreditAssessment(updatedBorrower);

            // Update local state list
            setBorrowers(prev => prev.map(item => item.id === b.id ? updatedBorrower : item));
            setSavingsModalBorrower(updatedBorrower);
            setIsSubmittingSavings(false);
            setSavingsSuccessMsg(`Successfully processed ${savingsActionType === 'deposit' ? 'Deposit' : 'Withdrawal'} of ₱${savingsAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}! New CBU Balance: ₱${newBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })} (Ref: ${refNo})`);
          };

          return (
            <div className={`no-print ${styles.modalBackdrop}`}>
              <div className={styles.modalDialog}>
                {/* Header */}
                <div className={styles.modalHeader}>
                  <div className={styles.modalHeaderTitleGroup}>
                    <div className={styles.modalHeaderIcon}>
                      <Wallet size={20} color="#15803d" />
                    </div>
                    <div>
                      <h3 className={styles.modalTitle}>
                        Deposit / Withdraw Savings (CBU)
                      </h3>
                      <span className={styles.modalSubtitle}>
                        {b.borrowerName} &bull; MCID: {b.mcid || b.cidNumber || 'TCID-A-00001'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSavingsModalBorrower(null)}
                    className={styles.modalCloseBtn}
                    aria-label="Close savings"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Content */}
                <div className={styles.modalBody}>
                  {savingsSuccessMsg ? (
                    <div style={{ textAlign: 'center', padding: '16px 8px' }}>
                      <div style={{ width: '48px', height: '48px', backgroundColor: '#dcfce7', borderRadius: '50%', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                        <CheckCircle size={28} />
                      </div>
                      <h4 style={{ fontSize: '16px', fontWeight: '800', color: '#15803d', margin: '0 0 6px 0' }}>
                        Savings Transaction Confirmed!
                      </h4>
                      <p style={{ fontSize: '12.5px', color: '#334155', margin: '0 0 16px 0' }}>
                        {savingsSuccessMsg}
                      </p>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setSavingsModalBorrower(null);
                            handleOpenPassbookModal(b);
                          }}
                          className={styles.btnConfirm}
                        >
                          View Passbook CBU Record
                        </button>
                        <button
                          type="button"
                          onClick={() => setSavingsModalBorrower(null)}
                          className={styles.btnCancel}
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {/* Current Balance Display */}
                      <div style={{ backgroundColor: '#f8fbf9', padding: '12px 16px', borderRadius: '10px', border: '1px solid #dcece0', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: '10.5px', color: '#475569', textTransform: 'uppercase', fontWeight: '700', display: 'block' }}>Current CBU Savings Balance</span>
                          <span style={{ fontSize: '11px', color: '#15803d', fontWeight: '700' }}>Minimum Floor: ₱500.00</span>
                        </div>
                        <strong style={{ fontSize: '20px', fontWeight: '900', color: '#15803d' }}>
                          ₱ {currentSavings.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </strong>
                      </div>

                      {/* Action Type Toggle */}
                      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                        <button
                          type="button"
                          onClick={() => setSavingsActionType('deposit')}
                          style={{
                            flex: 1,
                            padding: '10px',
                            borderRadius: '8px',
                            border: '1.5px solid',
                            borderColor: savingsActionType === 'deposit' ? '#16a34a' : '#d1e5d6',
                            backgroundColor: savingsActionType === 'deposit' ? '#f0fdf4' : '#ffffff',
                            color: savingsActionType === 'deposit' ? '#15803d' : '#64748b',
                            fontWeight: '800',
                            fontSize: '13px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                          }}
                        >
                          <ArrowDownLeft size={16} /> Deposit Savings
                        </button>
                        <button
                          type="button"
                          onClick={() => setSavingsActionType('withdraw')}
                          style={{
                            flex: 1,
                            padding: '10px',
                            borderRadius: '8px',
                            border: '1.5px solid',
                            borderColor: savingsActionType === 'withdraw' ? '#dc2626' : '#d1e5d6',
                            backgroundColor: savingsActionType === 'withdraw' ? '#fee2e2' : '#ffffff',
                            color: savingsActionType === 'withdraw' ? '#dc2626' : '#64748b',
                            fontWeight: '800',
                            fontSize: '13px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                          }}
                        >
                          <ArrowUpRight size={16} /> Withdraw Savings
                        </button>
                      </div>

                      {/* Form Fields */}
                      <div className={styles.modalFieldGroup}>
                        <label className={styles.modalLabel}>
                          {savingsActionType === 'deposit' ? 'Deposit Amount (₱)' : 'Withdrawal Amount (₱)'}
                        </label>
                        <input
                          type="number"
                          value={savingsAmount || ''}
                          onChange={(e) => setSavingsAmount(parseFloat(e.target.value) || 0)}
                          className={styles.modalInputAmount}
                          placeholder="0.00"
                        />
                      </div>

                      <div className={styles.modalFieldGroup}>
                        <label className={styles.modalLabel}>
                          Transaction Channel
                        </label>
                        <select
                          value={savingsMethod}
                          onChange={(e: any) => setSavingsMethod(e.target.value)}
                          className={styles.modalInput}
                        >
                          <option value="cash">Cash (Over-the-Counter / Field AO)</option>
                          <option value="gcash">GCash</option>
                          <option value="maya">Maya</option>
                          <option value="bank_transfer">Bank Transfer</option>
                        </select>
                      </div>

                      <div style={{ marginBottom: '14px' }}>
                        <label className={styles.modalLabel}>
                          Remarks / Receipt Note (Optional)
                        </label>
                        <input
                          type="text"
                          value={savingsNotes}
                          onChange={(e) => setSavingsNotes(e.target.value)}
                          className={styles.modalInput}
                          placeholder="e.g. Regular voluntary equity contribution"
                        />
                      </div>

                      {/* Required Account Officer Digital Signature Pad */}
                      <div className={`${styles.signatureBox} ${savingsAoSignature ? styles.signatureBoxCaptured : ''}`}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <label style={{ fontSize: '12px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                            <span className={styles.requiredBadge}>Required</span>
                            AO Authorization Signature (CBU Transaction)
                          </label>
                          <span style={{ fontSize: '11px', fontWeight: '700', color: savingsAoSignature ? '#16a34a' : '#dc2626' }}>
                            {savingsAoSignature ? '✓ Signature Captured' : '* Signature Required'}
                          </span>
                        </div>
                        <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', overflow: 'hidden' }}>
                          <SignaturePad
                            key={`sav-sig-${b.id}`}
                            onSave={(dataUrl) => setSavingsAoSignature(dataUrl)}
                            height={120}
                          />
                        </div>
                        <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
                          <span>Sign above using stylus or mouse as {b.evaluatedByOfficer || 'Officer Juan (AO-001)'}</span>
                          {savingsAoSignature && <span style={{ color: '#16a34a', fontWeight: '700' }}>✓ Verified</span>}
                        </div>
                      </div>

                      <div className={styles.modalFooter}>
                        <button
                          type="button"
                          onClick={() => setSavingsModalBorrower(null)}
                          className={styles.btnCancel}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleProcessSavings}
                          disabled={isSubmittingSavings}
                          className={savingsActionType === 'deposit' ? styles.btnConfirm : styles.btnConfirmDanger}
                        >
                          <CheckCircle size={15} /> Confirm {savingsActionType === 'deposit' ? 'Deposit' : 'Withdrawal'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
        {/* ============================================================== */}
        {/* LOAN RENEWAL MODAL                                             */}
        {/* ============================================================== */}
        {renewalModalBorrower && (() => {
          const b = renewalModalBorrower;
          const prevCycle = b.loanCycle || 1;
          const nextCycle = prevCycle + 1;
          const prevPrincipal = b.finalContractAmount || b.adminApprovedAmount || b.requestedAmount;
          const prevCalc = calculateTributeLoan(prevPrincipal, b.termMonths, b.productName, b.paymentMode);
          const totalPaid = b.totalCollected || 0;
          const currentRemBal = b.remainingBalance !== undefined ? b.remainingBalance : Math.max(0, prevCalc.contractualBalance - totalPaid);

          const prodRule = TRIBUTE_GRACE_PRODUCTS[renewalProduct] || TRIBUTE_GRACE_PRODUCTS['Regular Loan'];
          const maxAllowed = prodRule.absoluteMax;
          const minAllowed = prodRule.initialMin;

          // Compute new loan parameters (isRenewal = true)
          const newCalc = calculateTributeLoan(renewalAmount, renewalTerm, renewalProduct, renewalPaymentMode, true);
          const offsetDeduction = renewalOffsetBalance ? currentRemBal : 0;
          const estimatedNetCash = Math.max(0, newCalc.principal - newCalc.serviceCharge - offsetDeduction);

          const handleProcessRenewal = () => {
            if (renewalAmount < minAllowed || renewalAmount > maxAllowed) {
              alert(`Renewal loan amount must be between ₱${minAllowed.toLocaleString('en-PH')} and ₱${maxAllowed.toLocaleString('en-PH')}.`);
              return;
            }

            if (!renewalAoSignature) {
              alert('Account Officer digital signature is strictly required to authorize and submit this loan renewal application.');
              return;
            }

            setIsSubmittingRenewal(true);
            const now = new Date();
            const dateStr = now.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
            const officerName = b.evaluatedByOfficer || 'Officer Juan (AO-001)';
            const newLoanRef = generateNextLoanReference();
            const newAssessmentId = `CA-${newLoanRef.replace('NBR-', '').replace('TC-LN-', '')}`;

            // If offsetting balance, mark the previous loan remaining as 0 / fully settled by renewal
            if (currentRemBal > 0 && renewalOffsetBalance) {
              const settledOldBorrower: CreditAssessmentItem = {
                ...b,
                remainingBalance: 0,
                totalCollected: prevCalc.contractualBalance,
                status: 'disbursed'
              };
              saveCreditAssessment(settledOldBorrower);
            }

            // Create new Renewal Assessment Application Item
            const newRenewalItem: CreditAssessmentItem = {
              ...b,
              id: newAssessmentId,
              applicationId: newLoanRef,
              loanCycle: nextCycle,
              status: 'pending_admin',
              requestedAmount: renewalAmount,
              productName: renewalProduct,
              termMonths: renewalTerm,
              paymentMode: renewalPaymentMode,
              evaluatedByOfficer: officerName,
              evaluatedAt: dateStr,
              officerAdjustedAmount: renewalAmount,
              officerRecommendation: 'recommend_approve',
              officerNotes: `Loan Renewal (Cycle ${nextCycle}). ${renewalOffsetBalance && currentRemBal > 0 ? `Outstanding balance of ₱${currentRemBal.toLocaleString('en-PH', { minimumFractionDigits: 2 })} deducted from proceeds. ` : ''}${renewalNotes || 'Member in good standing eligible for facility renewal.'}`.trim(),
              adminApprovedAmount: renewalAmount,
              totalCollected: 0,
              remainingBalance: newCalc.contractualBalance,
              savingsBalance: b.savingsBalance !== undefined ? b.savingsBalance : newCalc.cbuAmount,
              paymentLedgerRecords: undefined, // Fresh schedule will be generated upon admin release
              officerSignatures: [
                {
                  signature: renewalAoSignature,
                  authId: `AUTH-RNW-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`,
                  timestamp: dateStr
                }
              ]
            };

            saveCreditAssessment(newRenewalItem);

            // Update local state list
            setBorrowers(prev => [newRenewalItem, ...prev.filter(item => item.id !== newRenewalItem.id)]);
            setIsSubmittingRenewal(false);
            setRenewalSuccessMsg(`Loan Renewal (Cycle ${nextCycle}) for ₱${renewalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })} successfully created with Reference ${newLoanRef} and submitted for Admin Approval!`);
          };

          return (
            <div className={`no-print ${styles.modalBackdrop}`}>
              <div className={`${styles.modalDialog} ${styles.modalDialogWide}`}>
                {/* Header */}
                <div className={styles.modalHeader}>
                  <div className={styles.modalHeaderTitleGroup}>
                    <div className={styles.modalHeaderIcon}>
                      <RotateCcw size={20} color="#15803d" />
                    </div>
                    <div>
                      <h3 className={styles.modalTitle}>
                        Loan Renewal Application &bull; Cycle {nextCycle}
                      </h3>
                      <span className={styles.modalSubtitle}>
                        {b.borrowerName} &bull; Member CID: {b.mcid || b.cidNumber || 'TCID-A-00001'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRenewalModalBorrower(null)}
                    className={styles.modalCloseBtn}
                    aria-label="Close loan renewal"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Content */}
                <div className={styles.modalBody}>
                  {renewalSuccessMsg ? (
                    <div style={{ textAlign: 'center', padding: '16px 8px' }}>
                      <div style={{ width: '48px', height: '48px', backgroundColor: '#dcfce7', borderRadius: '50%', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                        <CheckCircle size={28} />
                      </div>
                      <h4 style={{ fontSize: '16px', fontWeight: '800', color: '#15803d', margin: '0 0 6px 0' }}>
                        Loan Renewal Application Submitted!
                      </h4>
                      <p style={{ fontSize: '12.5px', color: '#334155', margin: '0 0 16px 0' }}>
                        {renewalSuccessMsg}
                      </p>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button
                          type="button"
                          onClick={() => setRenewalModalBorrower(null)}
                          className={styles.btnConfirm}
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {/* Member Track Record & Previous Facility Summary */}
                      <div className={styles.modalSummaryGrid}>
                        <div className={styles.modalSummaryBox}>
                          <span className={styles.modalSummaryLabel}>Previous Principal</span>
                          <strong style={{ fontSize: '13px', color: '#0f172a' }}>
                            ₱ {prevPrincipal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </strong>
                          <span style={{ fontSize: '9.5px', color: '#64748b', display: 'block' }}>Cycle {prevCycle}</span>
                        </div>
                        <div className={styles.modalSummaryBox}>
                          <span className={styles.modalSummaryLabel}>Total Repaid</span>
                          <strong style={{ fontSize: '13px', color: '#16a34a' }}>
                            ₱ {totalPaid.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </strong>
                          <span style={{ fontSize: '9.5px', color: '#16a34a', display: 'block' }}>Good Standing</span>
                        </div>
                        <div style={{ backgroundColor: currentRemBal > 0 ? '#fffbeb' : '#f0fdf4', padding: '10px 12px', borderRadius: '10px', border: currentRemBal > 0 ? '1px solid #fde68a' : '1px solid #bbf7d0' }}>
                          <span className={styles.modalSummaryLabel}>Remaining Balance</span>
                          <strong style={{ fontSize: '13px', color: currentRemBal > 0 ? '#d97706' : '#16a34a' }}>
                            ₱ {currentRemBal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </strong>
                          <span style={{ fontSize: '9.5px', color: currentRemBal > 0 ? '#b45309' : '#16a34a', display: 'block' }}>
                            {currentRemBal > 0 ? 'Eligible for Offset' : '100% Fully Settled'}
                          </span>
                        </div>
                      </div>

                      {/* Renewal Facility Options */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                        <div>
                          <label className={styles.modalLabel}>
                            Loan Product
                          </label>
                          <select
                            value={renewalProduct}
                            onChange={(e) => setRenewalProduct(e.target.value)}
                            className={styles.modalInput}
                          >
                            <option value="Regular Loan">Regular Loan (Max ₱50,000)</option>
                            <option value="Small Business Loan">Small Business Loan (Max ₱200,000)</option>
                            <option value="Agricultural / Crop Loan">Agricultural / Crop Loan (Max ₱100,000)</option>
                          </select>
                        </div>

                        <div>
                          <label className={styles.modalLabel}>
                            Renewal Principal (₱) &bull; Max ₱{maxAllowed.toLocaleString('en-PH')}
                          </label>
                          <input
                            type="number"
                            step="1000"
                            min={minAllowed}
                            max={maxAllowed}
                            value={renewalAmount || ''}
                            onChange={(e) => setRenewalAmount(parseFloat(e.target.value) || 0)}
                            className={styles.modalInputAmount}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                        <div>
                          <label className={styles.modalLabel}>
                            Loan Term (Months)
                          </label>
                          <select
                            value={renewalTerm}
                            onChange={(e) => setRenewalTerm(parseInt(e.target.value) || 3)}
                            className={styles.modalInput}
                          >
                            <option value={2}>2 Months</option>
                            <option value={3}>3 Months (Standard)</option>
                            <option value={4}>4 Months</option>
                            <option value={5}>5 Months</option>
                            <option value={6}>6 Months</option>
                          </select>
                        </div>

                        <div>
                          <label className={styles.modalLabel}>
                            Payment Mode / Frequency
                          </label>
                          <select
                            value={renewalPaymentMode}
                            onChange={(e: any) => setRenewalPaymentMode(e.target.value)}
                            className={styles.modalInput}
                          >
                            <option value="Weekly">Weekly (Recommended)</option>
                            <option value="Daily">Daily Mode</option>
                            <option value="Semi-Monthly">Semi-Monthly (15th / 30th)</option>
                            <option value="Monthly">Monthly</option>
                          </select>
                        </div>
                      </div>

                      {/* Outstanding Balance Offset Option */}
                      {currentRemBal > 0 && (
                        <div style={{
                          marginBottom: '14px',
                          backgroundColor: '#fffbeb',
                          border: '1px solid #fde68a',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}>
                          <div>
                            <span style={{ fontSize: '12px', fontWeight: '800', color: '#92400e', display: 'block' }}>
                              Deduct Remaining Balance from Proceeds?
                            </span>
                            <span style={{ fontSize: '11px', color: '#78350f' }}>
                              ₱{currentRemBal.toLocaleString('en-PH', { minimumFractionDigits: 2 })} will be settled automatically upon release.
                            </span>
                          </div>
                          <input
                            type="checkbox"
                            checked={renewalOffsetBalance}
                            onChange={(e) => setRenewalOffsetBalance(e.target.checked)}
                            style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#15803d' }}
                          />
                        </div>
                      )}

                      {/* Financial Breakdown Preview */}
                      <div style={{ backgroundColor: '#f8fbf9', border: '1px solid #dcece0', padding: '10px 14px', borderRadius: '10px', marginBottom: '14px', fontSize: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ color: '#475569' }}>Service Charge (1.5% &times; P &times; {renewalTerm} mos):</span>
                          <strong>₱ {newCalc.serviceCharge.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong>
                        </div>
                        {renewalOffsetBalance && currentRemBal > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: '#c2410c' }}>
                            <span>Less: Settled Previous Balance:</span>
                            <strong>- ₱ {currentRemBal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', borderTop: '1px dashed #d1e5d6', paddingTop: '4px' }}>
                          <span style={{ fontWeight: '700', color: '#0f172a' }}>Estimated Net Cash Proceeds:</span>
                          <strong style={{ color: '#16a34a', fontSize: '13px' }}>
                            ₱ {estimatedNetCash.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #d1e5d6', paddingTop: '4px' }}>
                          <span style={{ color: '#475569' }}>Installment Due ({renewalPaymentMode}):</span>
                          <strong style={{ color: '#15803d' }}>
                            ₱ {newCalc.installmentPerFrequency.toLocaleString('en-PH', { minimumFractionDigits: 2 })} / {renewalPaymentMode.toLowerCase()}
                          </strong>
                        </div>
                      </div>

                      {/* Renewal Notes */}
                      <div style={{ marginBottom: '14px' }}>
                        <label className={styles.modalLabel}>
                          AO Recommendation / Renewal Notes (Optional)
                        </label>
                        <input
                          type="text"
                          value={renewalNotes}
                          onChange={(e) => setRenewalNotes(e.target.value)}
                          className={styles.modalInput}
                          placeholder="e.g. Member consistently paid on schedule; recommends loan increase"
                        />
                      </div>

                      {/* Required AO Authorization Signature */}
                      <div className={`${styles.signatureBox} ${renewalAoSignature ? styles.signatureBoxCaptured : ''}`}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <label style={{ fontSize: '12px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                            <span className={styles.requiredBadge}>Required</span>
                            AO Renewal Endorsement Signature
                          </label>
                          <span style={{ fontSize: '11px', fontWeight: '700', color: renewalAoSignature ? '#16a34a' : '#dc2626' }}>
                            {renewalAoSignature ? '✓ Signature Captured' : '* Signature Required'}
                          </span>
                        </div>
                        <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', overflow: 'hidden' }}>
                          <SignaturePad
                            key={`rnw-sig-${b.id}`}
                            onSave={(dataUrl) => setRenewalAoSignature(dataUrl)}
                            height={120}
                          />
                        </div>
                        <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
                          <span>Sign above to endorse renewal as {b.evaluatedByOfficer || 'Officer Juan (AO-001)'}</span>
                          {renewalAoSignature && <span style={{ color: '#16a34a', fontWeight: '700' }}>✓ Verified</span>}
                        </div>
                      </div>

                      {/* Buttons */}
                      <div className={styles.modalFooter}>
                        <button
                          type="button"
                          onClick={() => setRenewalModalBorrower(null)}
                          className={styles.btnCancel}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleProcessRenewal}
                          disabled={isSubmittingRenewal}
                          className={styles.btnConfirm}
                        >
                          <CheckCircle size={15} /> Submit Renewal Application
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

      </main>

      {/* Floating Bottom App Navigation on mobile */}
      <OfficerMobileNav onOpenSidebar={() => setMobileMenuOpen(true)} />
    </div>
  );
}
