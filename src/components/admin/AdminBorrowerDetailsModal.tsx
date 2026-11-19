'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  X,
  User,
  Briefcase,
  ShieldCheck,
  FileText,
  BookOpen,
  FileSpreadsheet,
  ArrowUpRight,
  Printer,
  Eye,
  FileCheck2,
  Calendar,
  MapPin,
  CreditCard,
  Users,
  Wallet,
} from 'lucide-react';
import type { CreditAssessmentItem } from '@/lib/credit-assessment-store';
import {
  buildBorrowerDetailsViewModel,
  formatRecommendationLabel,
  type SignatureEntry,
} from '@/lib/borrower-record-mapper';
import { calculateTributeLoan } from '@/lib/tribute-loan-engine';
import { generateCollectionScheduleDates } from '@/lib/ph-holidays';
import {
  PassbookBooklet,
  LoanPaymentLedger,
  type PassbookData,
} from '@/components/passbook/PassbookBooklet';
import {
  OfficialSignatureBlock,
  getLatestOfficialSignature,
} from '@/components/common/OfficialSignatureBlock';
import { interpolateContractHtml } from '@/lib/contract-template-store';
import styles from './AdminBorrowerDetailsModal.module.css';

type DossierTab = 'profile' | 'assessment' | 'documents' | 'passbook';

interface AdminBorrowerDetailsModalProps {
  borrower: CreditAssessmentItem | null;
  onClose: () => void;
  reviewHref?: string;
}

function formatPeso(value: number | null | undefined): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return `₱ ${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getStatusBadgeClass(status: CreditAssessmentItem['status']): string {
  if (status === 'admin_approved' || status === 'contract_ready') return styles.statusApproved;
  if (status === 'disbursed') return styles.statusDisbursed;
  if (status === 'admin_rejected') return styles.statusRejected;
  return styles.statusPending;
}

function FieldRow({
  label,
  value,
  fallback = 'Not provided',
}: {
  label: string;
  value: string | number | null | undefined;
  fallback?: string;
}) {
  const hasValue = value !== null && value !== undefined && String(value).trim() !== '';
  return (
    <div className={styles.fieldRow}>
      <span className={styles.fieldLabel}>{label}</span>
      <span className={hasValue ? styles.fieldValue : `${styles.fieldValue} ${styles.mutedValue}`}>
        {hasValue ? String(value) : fallback}
      </span>
    </div>
  );
}

function SignatureGridSection({
  title,
  signatures,
  slotPrefix,
}: {
  title: string;
  signatures: SignatureEntry[];
  slotPrefix: string;
}) {
  return (
    <div className={styles.sectionCard}>
      <h4 className={styles.sectionTitle}>{title}</h4>
      {signatures.length === 0 ? (
        <p className={styles.emptyNote}>No captured signatures on record.</p>
      ) : (
        <div className={styles.signatureGrid}>
          {signatures.map((sig, idx) => (
            <div key={`${slotPrefix}-${idx}`} className={styles.sigCard}>
              <div className={styles.sigCardHead}>
                <span>{slotPrefix} #{idx + 1}</span>
                <span className={styles.sigAuthId}>{sig.authId || 'Auth ID unavailable'}</span>
              </div>
              <div className={styles.sigImgWrap}>
                <img src={sig.signature} alt={`${slotPrefix} signature ${idx + 1}`} className={styles.sigImg} />
              </div>
              <div className={styles.sigTimestamp}>
                {sig.timestamp || 'Timestamp unavailable'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const AdminBorrowerDetailsModal: React.FC<AdminBorrowerDetailsModalProps> = ({
  borrower,
  onClose,
  reviewHref,
}) => {
  const [activeTab, setActiveTab] = useState<DossierTab>('profile');
  const [passbookSubTab, setPassbookSubTab] = useState<'booklet' | 'ledger'>('booklet');
  const [showContractViewer, setShowContractViewer] = useState<boolean>(false);

  useEffect(() => {
    if (!borrower) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [borrower, onClose]);

  const vm = useMemo(
    () => (borrower ? buildBorrowerDetailsViewModel(borrower) : null),
    [borrower]
  );

  const loanCalc = useMemo(() => {
    if (!vm || vm.loan.effectivePrincipal <= 0) return null;
    const isRenewal = (vm.identity.loanCycle || 1) > 1;
    return calculateTributeLoan(
      vm.loan.effectivePrincipal,
      vm.loan.termMonths || 3,
      vm.loan.productName || 'Regular Loan',
      vm.loan.paymentMode || 'Weekly',
      isRenewal
    );
  }, [vm]);

  const passbookData = useMemo<PassbookData | null>(() => {
    if (!borrower || !vm) return null;
    const principal = vm.loan.effectivePrincipal;
    const termMonths = vm.loan.termMonths || 3;
    const paymentMode = vm.loan.paymentMode || 'Weekly';
    const releaseDateStr = vm.governance.disbursedAt || vm.governance.contractExecutedAt || vm.governance.adminActionAt || '';

    const parsedDate = releaseDateStr ? new Date(releaseDateStr) : null;
    const validBaseDate = parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate : null;

    const paymentRecords =
      vm.ledger.paymentRecords.length > 0
        ? vm.ledger.paymentRecords
        : validBaseDate && loanCalc
          ? generateCollectionScheduleDates(validBaseDate, termMonths, paymentMode).map((item) => ({
              installmentNo: item.installmentNo,
              paymentSchedule: item.dateStr,
              status: 'Pending' as const,
              principalAmount: principal,
              interest: Math.round(loanCalc.totalInterest / Math.max(1, loanCalc.numberOfInstallments)),
            }))
          : [];

    const cbuInitial = loanCalc ? loanCalc.cbuAmount : 0;
    const cbuBalance = vm.ledger.savingsBalance !== null ? vm.ledger.savingsBalance : cbuInitial;
    const cbuRecords =
      vm.ledger.savingsRecords.length > 0
        ? vm.ledger.savingsRecords.map((s) => ({
            paymentSchedule: s.notes || (s.type === 'deposit' ? 'Member Deposit' : 'Member Withdrawal'),
            datePaid: s.date,
            cbuIn: s.type === 'deposit' ? s.amount : 0,
            cbuOut: s.type === 'withdraw' ? s.amount : 0,
            cbuBalance: s.runningBalance,
            aoSignature: s.aoSignature || s.referenceNo || undefined,
          }))
        : [];

    const aoSigs = vm.signatures.officerSignatures.map((s) => ({
      signature: s.signature,
      authId: s.authId || undefined,
      timestamp: s.timestamp || undefined,
    }));
    const adminSigs = vm.signatures.adminSignatures.map((s) => ({
      signature: s.signature,
      authId: s.authId || undefined,
      timestamp: s.timestamp || undefined,
    }));
    const borrowerSigs = vm.signatures.borrowerSignatures.map((s) => ({
      signature: s.signature,
      authId: s.authId || undefined,
      timestamp: s.timestamp || undefined,
    }));

    return {
      borrowerName: vm.identity.borrowerName,
      cidNumber: vm.identity.mcid || vm.identity.policyNo || 'Not assigned',
      mcidNumber: vm.identity.mcid || undefined,
      loanReference: vm.identity.loanReference || vm.identity.id,
      spouseName: vm.identity.spouseName || 'Not provided',
      permanentAddress: vm.address.fullAddress || 'Not provided',
      membershipDate: vm.identity.membershipDate || 'Not provided',
      dateIssued: vm.governance.disbursedAt || vm.governance.contractExecutedAt || 'Pending issuance',
      issuedByName: vm.assessment.evaluatedByOfficer || undefined,
      dateReleased: vm.governance.disbursedAt || 'Pending disbursement',
      loanType: vm.loan.productName || 'Not specified',
      loanAmount: principal,
      paymentMode,
      termMonths,
      cycle: vm.identity.loanCycle || 1,
      cbuInitialDeposit: cbuInitial,
      cbuBalance,
      borrowerPhoto: vm.documents.applicantFacePhoto || undefined,
      borrowerHoldingIdPhoto: vm.documents.borrowerHoldingIdPhoto || undefined,
      specimenSignature: vm.signatures.applicantSignature || borrowerSigs[0]?.signature,
      specimenSignatures: borrowerSigs.length > 0 ? borrowerSigs : undefined,
      aoSignatures: aoSigs.length > 0 ? aoSigs : undefined,
      adminSignatures: adminSigs.length > 0 ? adminSigs : undefined,
      adminActionAt: vm.governance.adminActionAt || undefined,
      paymentRecords,
      cbuRecords,
    };
  }, [borrower, vm, loanCalc]);

  if (!borrower || !vm) return null;

  const officialAo = getLatestOfficialSignature(
    vm.signatures.officerSignatures.map((s) => ({
      signature: s.signature,
      authId: s.authId || undefined,
      timestamp: s.timestamp || undefined,
    })),
    vm.assessment.evaluatedByOfficer || undefined,
    'Account Officer'
  );
  const officialAdmin = getLatestOfficialSignature(
    vm.signatures.adminSignatures.map((s) => ({
      signature: s.signature,
      authId: s.authId || undefined,
      timestamp: s.timestamp || undefined,
    })),
    undefined,
    'Branch General Manager / Credit Approver',
    vm.governance.adminActionAt || undefined
  );

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label={`Borrower dossier for ${vm.identity.borrowerName}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.dialog}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerIdentity}>
            {vm.documents.applicantFacePhoto ? (
              <img
                src={vm.documents.applicantFacePhoto}
                alt={vm.identity.borrowerName}
                className={styles.avatarPhoto}
              />
            ) : (
              <div className={styles.avatarFallback}>
                {vm.identity.borrowerName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className={styles.titleBlock}>
              <div className={styles.titleRow}>
                <h2 className={styles.title}>{vm.identity.borrowerName}</h2>
                <span className={`${styles.statusBadge} ${getStatusBadgeClass(vm.governance.status)}`}>
                  {vm.governance.statusLabel}
                </span>
                {vm.identity.loanCycle && (
                  <span className={styles.monoTag}>Cycle {vm.identity.loanCycle}</span>
                )}
              </div>
              <div className={styles.subtitle}>
                <span className={styles.monoTag}>{vm.identity.loanReference || vm.identity.id}</span>
                {vm.identity.mcid && <span className={styles.monoTag}>MCID: {vm.identity.mcid}</span>}
                {vm.identity.policyNo && <span className={styles.monoTag}>Policy: {vm.identity.policyNo}</span>}
              </div>
            </div>
          </div>

          <div className={styles.headerActions}>
            {reviewHref && (
              <Link href={reviewHref} className={styles.reviewPageLink} onClick={onClose}>
                Open in Loan Approvals <ArrowUpRight size={14} />
              </Link>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className={styles.closeBtn}
            aria-label="Close borrower dossier"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Bar */}
        <div className={styles.tabBar} role="tablist" aria-label="Borrower dossier sections">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'profile'}
            onClick={() => setActiveTab('profile')}
            className={`${styles.tabBtn} ${activeTab === 'profile' ? styles.tabBtnActive : ''}`}
          >
            <User size={15} /> Profile &amp; Financials
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'assessment'}
            onClick={() => setActiveTab('assessment')}
            className={`${styles.tabBtn} ${activeTab === 'assessment' ? styles.tabBtnActive : ''}`}
          >
            <ShieldCheck size={15} /> Loan, 5 Cs &amp; Governance
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'documents'}
            onClick={() => setActiveTab('documents')}
            className={`${styles.tabBtn} ${activeTab === 'documents' ? styles.tabBtnActive : ''}`}
          >
            <FileText size={15} /> Documents &amp; Signatures
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'passbook'}
            onClick={() => setActiveTab('passbook')}
            className={`${styles.tabBtn} ${activeTab === 'passbook' ? styles.tabBtnActive : ''}`}
          >
            <BookOpen size={15} /> Passbook &amp; Ledger
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {/* TAB 1: PROFILE & FINANCIALS */}
          {activeTab === 'profile' && (
            <>
              <div className={styles.summaryGrid}>
                <div className={styles.summaryCard}>
                  <span className={styles.summaryLabel}>Requested Loan</span>
                  <span className={styles.summaryValue}>
                    {formatPeso(vm.loan.requestedAmount) || 'Not provided'}
                  </span>
                </div>
                <div className={styles.summaryCard}>
                  <span className={styles.summaryLabel}>Approved / Contract Principal</span>
                  <span className={`${styles.summaryValue} ${styles.summaryValueAccent}`}>
                    {formatPeso(vm.loan.finalContractAmount ?? vm.loan.adminApprovedAmount) || 'Pending approval'}
                  </span>
                </div>
                <div className={styles.summaryCard}>
                  <span className={styles.summaryLabel}>Monthly Net Income</span>
                  <span className={styles.summaryValue}>
                    {formatPeso(vm.livelihood.monthlyNetIncome) || 'Not provided'}
                  </span>
                </div>
                <div className={styles.summaryCard}>
                  <span className={styles.summaryLabel}>Net Disposable Income</span>
                  <span className={styles.summaryValue}>
                    {formatPeso(vm.livelihood.netDisposableIncome) || 'Not provided'}
                  </span>
                </div>
              </div>

              <div className={styles.sectionGrid}>
                {/* Identity & Contact */}
                <div className={styles.sectionCard}>
                  <h4 className={styles.sectionTitle}>
                    <User size={14} color="#B91C1C" /> Member Identity &amp; Contact
                  </h4>
                  <div className={styles.fieldList}>
                    <FieldRow label="Full Legal Name" value={vm.identity.borrowerName} />
                    <FieldRow label="Cooperative MCID" value={vm.identity.mcid} />
                    <FieldRow label="TGSWS Policy No." value={vm.identity.policyNo} />
                    <FieldRow label="Loan Reference" value={vm.identity.loanReference || vm.identity.id} />
                    <FieldRow label="Contact Number" value={vm.identity.contactNumber} />
                    <FieldRow label="Email Address" value={vm.identity.email} />
                    <FieldRow label="Date of Birth" value={vm.identity.birthDate} />
                    <FieldRow label="Sex" value={vm.identity.sex} />
                    <FieldRow label="Civil Status" value={vm.identity.civilStatus} />
                    <FieldRow label="Nationality" value={vm.identity.nationality} />
                    <FieldRow label="Spouse Name" value={vm.identity.spouseName} />
                    <FieldRow label="Membership Date" value={vm.identity.membershipDate} />
                  </div>
                </div>

                {/* Address & Demographics */}
                <div className={styles.sectionCard}>
                  <h4 className={styles.sectionTitle}>
                    <MapPin size={14} color="#B91C1C" /> Address &amp; Residency
                  </h4>
                  <div className={styles.fieldList}>
                    <FieldRow label="Full Address" value={vm.address.fullAddress} />
                    <FieldRow label="Street / Line 1" value={vm.address.addressLine1} />
                    <FieldRow label="Barangay" value={vm.address.barangay} />
                    <FieldRow label="City / Municipality" value={vm.address.city} />
                    <FieldRow label="Province" value={vm.address.province} />
                    <FieldRow label="Residence Type" value={vm.address.residenceType} />
                  </div>

                  <h4 className={styles.sectionTitle} style={{ marginTop: '16px' }}>
                    <CreditCard size={14} color="#B91C1C" /> Government IDs
                  </h4>
                  {vm.identity.govIds.length === 0 ? (
                    <p className={styles.emptyNote}>No government ID records captured.</p>
                  ) : (
                    <div className={styles.recordList}>
                      {vm.identity.govIds.map((gid, i) => (
                        <div key={`gid-${i}`} className={styles.recordItem}>
                          <div>
                            <div className={styles.recordPrimary}>{gid.type}</div>
                            <div className={styles.recordSecondary}>{gid.number || 'ID number not provided'}</div>
                          </div>
                          {gid.expiry && <span className={styles.recordSecondary}>Exp: {gid.expiry}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Employment / Livelihood & Cashflow */}
                <div className={styles.sectionCard}>
                  <h4 className={styles.sectionTitle}>
                    <Briefcase size={14} color="#B91C1C" /> Employment, Livelihood &amp; Cash Flow
                  </h4>
                  <div className={styles.fieldList}>
                    <FieldRow label="Occupation / Livelihood" value={vm.livelihood.occupation} />
                    <FieldRow label="Business Name" value={vm.livelihood.businessName} />
                    <FieldRow label="Business Type" value={vm.livelihood.businessType} />
                    <FieldRow
                      label="Years in Operation"
                      value={vm.livelihood.yearsInBusiness !== null ? `${vm.livelihood.yearsInBusiness} yr(s)` : null}
                    />
                    <FieldRow label="Monthly Net Income" value={formatPeso(vm.livelihood.monthlyNetIncome)} />
                    <FieldRow label="Household Expenses" value={formatPeso(vm.livelihood.monthlyHouseholdExpenses)} />
                    <FieldRow label="Existing Monthly Debts" value={formatPeso(vm.livelihood.existingDebts)} />
                    <FieldRow label="Net Disposable Income" value={formatPeso(vm.livelihood.netDisposableIncome)} />
                  </div>

                  {vm.livelihood.coMaker && (
                    <>
                      <h4 className={styles.sectionTitle} style={{ marginTop: '16px' }}>
                        <Users size={14} color="#B91C1C" /> Co-Maker / Guarantor
                      </h4>
                      <div className={styles.fieldList}>
                        <FieldRow label="Co-Maker Name" value={vm.livelihood.coMaker.name} />
                        <FieldRow label="Relationship" value={vm.livelihood.coMaker.relationship} />
                        <FieldRow label="Contact" value={vm.livelihood.coMaker.contact} />
                        <FieldRow label="Income Source" value={vm.livelihood.coMaker.incomeSource} />
                      </div>
                    </>
                  )}
                </div>

                {/* Household Dependants, Assets, Other Incomes, Liabilities */}
                <div className={styles.sectionCard}>
                  <h4 className={styles.sectionTitle}>
                    <Wallet size={14} color="#B91C1C" /> Dependants, Assets &amp; Obligations
                  </h4>

                  <div className={styles.fieldList}>
                    <FieldRow label="Dependants on Record" value={vm.identity.dependants.length} />
                  </div>
                  {vm.identity.dependants.length > 0 && (
                    <div className={styles.recordList} style={{ marginTop: '8px', marginBottom: '12px' }}>
                      {vm.identity.dependants.map((dep, i) => (
                        <div key={`dep-${i}`} className={styles.recordItem}>
                          <div>
                            <div className={styles.recordPrimary}>{dep.name}</div>
                            <div className={styles.recordSecondary}>
                              {[dep.relation, dep.age ? `Age ${dep.age}` : null, dep.occupation].filter(Boolean).join(' • ') || 'Relationship not specified'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className={styles.fieldList} style={{ marginTop: '8px' }}>
                    <FieldRow label="Declared Assets" value={vm.livelihood.assets.length} />
                  </div>
                  {vm.livelihood.assets.length > 0 && (
                    <div className={styles.recordList} style={{ marginTop: '8px', marginBottom: '12px' }}>
                      {vm.livelihood.assets.map((asset, i) => (
                        <div key={`asset-${i}`} className={styles.recordItem}>
                          <div>
                            <div className={styles.recordPrimary}>{asset.description}</div>
                            {asset.status && <div className={styles.recordSecondary}>{asset.status}</div>}
                          </div>
                          <strong>{formatPeso(asset.estimatedValue) || 'Value not stated'}</strong>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className={styles.fieldList} style={{ marginTop: '8px' }}>
                    <FieldRow label="Other Income Sources" value={vm.livelihood.otherIncomes.length} />
                  </div>
                  {vm.livelihood.otherIncomes.length > 0 && (
                    <div className={styles.recordList} style={{ marginTop: '8px', marginBottom: '12px' }}>
                      {vm.livelihood.otherIncomes.map((inc, i) => (
                        <div key={`inc-${i}`} className={styles.recordItem}>
                          <span className={styles.recordPrimary}>{inc.source}</span>
                          <strong>{formatPeso(inc.monthlyAmount) || 'Amount not stated'}</strong>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className={styles.fieldList} style={{ marginTop: '8px' }}>
                    <FieldRow label="Declared Liabilities" value={vm.livelihood.liabilities.length} />
                  </div>
                  {vm.livelihood.liabilities.length > 0 && (
                    <div className={styles.recordList} style={{ marginTop: '8px' }}>
                      {vm.livelihood.liabilities.map((liab, i) => (
                        <div key={`liab-${i}`} className={styles.recordItem}>
                          <div>
                            <div className={styles.recordPrimary}>{liab.creditor}</div>
                            <div className={styles.recordSecondary}>
                              Monthly: {formatPeso(liab.monthlyPayment) || 'N/A'}
                            </div>
                          </div>
                          <strong>Bal: {formatPeso(liab.remainingBalance) || 'N/A'}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* TAB 2: LOAN, 5 CS & GOVERNANCE */}
          {activeTab === 'assessment' && (
            <>
              <div className={styles.summaryGrid}>
                <div className={styles.summaryCard}>
                  <span className={styles.summaryLabel}>Requested Amount</span>
                  <span className={styles.summaryValue}>{formatPeso(vm.loan.requestedAmount) || 'Not provided'}</span>
                </div>
                <div className={styles.summaryCard}>
                  <span className={styles.summaryLabel}>AI Pre-Approved</span>
                  <span className={styles.summaryValue}>{formatPeso(vm.loan.aiPreApprovedAmount) || 'Not available'}</span>
                </div>
                <div className={styles.summaryCard}>
                  <span className={styles.summaryLabel}>AO Recommended</span>
                  <span className={styles.summaryValue}>{formatPeso(vm.loan.officerAdjustedAmount) || 'Not provided'}</span>
                </div>
                <div className={styles.summaryCard}>
                  <span className={styles.summaryLabel}>Admin Approved</span>
                  <span className={`${styles.summaryValue} ${styles.summaryValueAccent}`}>
                    {formatPeso(vm.governance.adminApprovedAmount) || 'Pending'}
                  </span>
                </div>
              </div>

              <div className={styles.sectionGrid}>
                <div className={styles.sectionCard}>
                  <h4 className={styles.sectionTitle}>Loan Terms &amp; Computed Schedule</h4>
                  <div className={styles.fieldList}>
                    <FieldRow label="Loan Product" value={vm.loan.productName} />
                    <FieldRow label="Term" value={vm.loan.termMonths ? `${vm.loan.termMonths} Months` : null} />
                    <FieldRow label="Repayment Frequency" value={vm.loan.paymentMode} />
                    <FieldRow label="Loan Purpose" value={vm.loan.loanPurpose} />
                    <FieldRow label="Final Contract Amount" value={formatPeso(vm.loan.finalContractAmount)} fallback="Not finalized" />
                    <FieldRow
                      label="Scheduled Installment"
                      value={loanCalc ? `${formatPeso(loanCalc.installmentPerFrequency)} / ${vm.loan.paymentMode || 'period'}` : null}
                      fallback="Unavailable"
                    />
                    <FieldRow
                      label="Total Contractual Balance"
                      value={loanCalc ? formatPeso(loanCalc.contractualBalance) : null}
                      fallback="Unavailable"
                    />
                    <FieldRow
                      label="CBU Retention"
                      value={loanCalc ? formatPeso(loanCalc.cbuAmount) : null}
                      fallback="Unavailable"
                    />
                  </div>
                </div>

                <div className={styles.sectionCard}>
                  <h4 className={styles.sectionTitle}>AI Pre-Approval &amp; AO Endorsement</h4>
                  <div className={styles.fieldList}>
                    <FieldRow label="AI Risk Rating" value={vm.assessment.aiRiskRating} />
                    <FieldRow label="AI Debt Service Ratio" value={vm.assessment.aiDsr !== null ? `${vm.assessment.aiDsr}%` : null} />
                    <FieldRow label="AI Confidence Score" value={vm.assessment.aiConfidenceScore !== null ? `${vm.assessment.aiConfidenceScore}%` : null} />
                    <FieldRow label="AO Recommendation" value={formatRecommendationLabel(vm.assessment.officerRecommendation)} />
                    <FieldRow label="Evaluated By" value={vm.assessment.evaluatedByOfficer} />
                    <FieldRow label="Evaluated At" value={vm.assessment.evaluatedAt} />
                  </div>
                  {vm.assessment.aiRecommendationNote && (
                    <div className={styles.quoteBox}>
                      <strong>AI Note:</strong> {vm.assessment.aiRecommendationNote}
                    </div>
                  )}
                  {vm.assessment.officerNotes && (
                    <div className={styles.quoteBox}>
                      <strong>AO CI Notes:</strong> &ldquo;{vm.assessment.officerNotes}&rdquo;
                    </div>
                  )}
                </div>
              </div>

              {/* Complete 5 Cs Scorecard */}
              <div className={styles.sectionCard}>
                <h4 className={styles.sectionTitle}>
                  5 Cs Credit Assessment Scorecard{' '}
                  {vm.assessment.fiveCs && (
                    <span className={styles.monoTag}>
                      {vm.assessment.fiveCs.totalScore}/100 &bull; {vm.assessment.fiveCs.riskGrade}
                    </span>
                  )}
                </h4>
                {vm.assessment.fiveCs ? (
                  <div className={styles.fiveCsGrid}>
                    <div className={styles.fiveCsItem}>
                      <div className={styles.fiveCsHead}>
                        <span>1. Character</span>
                        <span className={styles.fiveCsScore}>{vm.assessment.fiveCs.characterScore}/20</span>
                      </div>
                      <p className={styles.fiveCsNotes}>{vm.assessment.fiveCs.characterNotes || 'No notes recorded.'}</p>
                    </div>
                    <div className={styles.fiveCsItem}>
                      <div className={styles.fiveCsHead}>
                        <span>2. Capacity</span>
                        <span className={styles.fiveCsScore}>{vm.assessment.fiveCs.capacityScore}/25</span>
                      </div>
                      <p className={styles.fiveCsNotes}>{vm.assessment.fiveCs.capacityNotes || 'No notes recorded.'}</p>
                    </div>
                    <div className={styles.fiveCsItem}>
                      <div className={styles.fiveCsHead}>
                        <span>3. Capital</span>
                        <span className={styles.fiveCsScore}>{vm.assessment.fiveCs.capitalScore}/20</span>
                      </div>
                      <p className={styles.fiveCsNotes}>{vm.assessment.fiveCs.capitalNotes || 'No notes recorded.'}</p>
                    </div>
                    <div className={styles.fiveCsItem}>
                      <div className={styles.fiveCsHead}>
                        <span>4. Collateral</span>
                        <span className={styles.fiveCsScore}>{vm.assessment.fiveCs.collateralScore}/20</span>
                      </div>
                      <p className={styles.fiveCsNotes}>{vm.assessment.fiveCs.collateralNotes || 'No notes recorded.'}</p>
                    </div>
                    <div className={styles.fiveCsItem}>
                      <div className={styles.fiveCsHead}>
                        <span>5. Conditions</span>
                        <span className={styles.fiveCsScore}>{vm.assessment.fiveCs.conditionsScore}/15</span>
                      </div>
                      <p className={styles.fiveCsNotes}>{vm.assessment.fiveCs.conditionsNotes || 'No notes recorded.'}</p>
                    </div>
                  </div>
                ) : (
                  <p className={styles.emptyNote}>5 Cs scorecard has not been recorded for this application yet.</p>
                )}
              </div>

              {/* Governance, Reconsideration & Disbursement */}
              <div className={styles.sectionGrid}>
                <div className={styles.sectionCard}>
                  <h4 className={styles.sectionTitle}>Admin Decision &amp; Reconsideration History</h4>
                  <div className={styles.fieldList}>
                    <FieldRow label="Governance Status" value={vm.governance.statusLabel} />
                    <FieldRow label="Admin Approved Amount" value={formatPeso(vm.governance.adminApprovedAmount)} fallback="Not approved yet" />
                    <FieldRow label="Previous Approved Amount" value={formatPeso(vm.governance.previousAdminApprovedAmount)} fallback="None" />
                    <FieldRow label="Reconsideration Rounds" value={`${vm.governance.adjustmentCount} / 3`} />
                    <FieldRow label="Admin Action Timestamp" value={vm.governance.adminActionAt} fallback="Pending" />
                    <FieldRow label="Contract Executed At" value={vm.governance.contractExecutedAt} fallback="Pending" />
                  </div>
                  {vm.governance.reconsiderationJustification && (
                    <div className={styles.reconsiderationBox}>
                      <strong>AO Reconsideration Justification:</strong> &ldquo;{vm.governance.reconsiderationJustification}&rdquo;
                    </div>
                  )}
                  {vm.governance.adminNotes && (
                    <div className={styles.quoteBox}>
                      <strong>Admin Committee Notes:</strong> {vm.governance.adminNotes}
                    </div>
                  )}
                </div>

                <div className={styles.sectionCard}>
                  <h4 className={styles.sectionTitle}>Disbursement Information</h4>
                  <div className={styles.fieldList}>
                    <FieldRow
                      label="Disbursement Mode"
                      value={vm.governance.disbursementMode === 'online' ? 'Online Transfer' : vm.governance.disbursementMode === 'cash' ? 'Over-the-Counter Cash' : null}
                    />
                    <FieldRow label="Channel" value={vm.governance.disbursementChannel} />
                    <FieldRow label="Account Number" value={vm.governance.disbursementAccountNumber} />
                    <FieldRow label="Admin Release Auth ID" value={vm.governance.adminDisbursementRelease?.authId} fallback="Pending Admin release" />
                    <FieldRow label="Admin Released At" value={vm.governance.adminDisbursementRelease?.timestamp} fallback="Pending Admin release" />
                    <FieldRow label="AO Confirmation Auth ID" value={vm.governance.aoDisbursementConfirmation?.authId} fallback="Pending AO confirmation" />
                    <FieldRow label="Disbursed At" value={vm.governance.disbursedAt} fallback="Not disbursed" />
                    <FieldRow label="Disbursed By" value={vm.governance.disbursedBy} fallback="Not disbursed" />
                    <FieldRow label="Voucher / Ref No." value={vm.governance.disbursementReferenceNo} fallback="None" />
                    <FieldRow label="Disbursement Notes" value={vm.governance.disbursementNotes} fallback="None" />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* TAB 3: DOCUMENTS & SIGNATURES */}
          {activeTab === 'documents' && (
            <>
              <div className={styles.sectionCard}>
                <h4 className={styles.sectionTitle}>Biometric Verification &amp; Identity Photos</h4>
                <div className={styles.mediaGrid}>
                  <div className={styles.mediaCard}>
                    <span className={styles.fieldLabel}>Live Biometric Face Capture</span>
                    {vm.documents.applicantFacePhoto ? (
                      <img src={vm.documents.applicantFacePhoto} alt="Borrower Face Capture" className={styles.mediaImg} />
                    ) : (
                      <p className={styles.emptyNote}>No face photo captured yet.</p>
                    )}
                  </div>
                  <div className={styles.mediaCard}>
                    <span className={styles.fieldLabel}>Borrower Holding Government ID</span>
                    {vm.documents.borrowerHoldingIdPhoto ? (
                      <img src={vm.documents.borrowerHoldingIdPhoto} alt="Borrower Holding ID" className={styles.mediaImg} />
                    ) : (
                      <p className={styles.emptyNote}>No holding-ID photo captured yet.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className={styles.sectionCard}>
                <h4 className={styles.sectionTitle}>Uploaded Supporting Documents</h4>
                {vm.documents.attachments.length === 0 ? (
                  <p className={styles.emptyNote}>No supporting document attachments recorded.</p>
                ) : (
                  <div className={styles.recordList}>
                    {vm.documents.attachments.map((att, idx) => (
                      <div key={`att-${idx}`} className={styles.recordItem}>
                        <div>
                          <div className={styles.recordPrimary}>{att.label}</div>
                          {att.name && <div className={styles.recordSecondary}>{att.name}</div>}
                        </div>
                        {att.url && (
                          <a href={att.url} target="_blank" rel="noreferrer" className={styles.monoTag}>
                            View File
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className={styles.sectionCard}>
                <h4 className={styles.sectionTitle}>Official Authorization Summary</h4>
                <div className={styles.officialSignersGrid}>
                  <OfficialSignatureBlock
                    signature={officialAo?.signature}
                    authId={officialAo?.authId}
                    timestamp={officialAo?.timestamp}
                    signerName={officialAo?.signerName}
                    roleTitle="Account Officer Verification"
                    variant="card"
                  />
                  <OfficialSignatureBlock
                    signature={officialAdmin?.signature}
                    authId={officialAdmin?.authId}
                    timestamp={officialAdmin?.timestamp}
                    signerName={officialAdmin?.signerName}
                    roleTitle="Admin Committee Approval"
                    variant="card"
                  />
                </div>
              </div>

              <SignatureGridSection
                title="Borrower Specimen Signatures"
                signatures={
                  vm.signatures.borrowerSignatures.length > 0
                    ? vm.signatures.borrowerSignatures
                    : vm.signatures.applicantSignature
                      ? [{ signature: vm.signatures.applicantSignature, authId: null, timestamp: null }]
                      : []
                }
                slotPrefix="Borrower Sign"
              />

              <SignatureGridSection
                title="Account Officer Signatures"
                signatures={vm.signatures.officerSignatures}
                slotPrefix="AO Sign"
              />

              {(vm.governance.adminDisbursementRelease || vm.governance.aoDisbursementConfirmation) && (
                <div className={styles.sectionCard}>
                  <h4 className={styles.sectionTitle}>Two-Stage Disbursement Audit Proofs</h4>
                  <div className={styles.mediaGrid}>
                    {vm.governance.adminDisbursementRelease && (
                      <div className={styles.mediaCard}>
                        <span className={styles.fieldLabel}>
                          Stage 1: Admin Release ({vm.governance.adminDisbursementRelease.signerName} • {vm.governance.adminDisbursementRelease.authId})
                        </span>
                        <span className={styles.recordSecondary}>
                          {vm.governance.adminDisbursementRelease.timestamp} • Ref: {vm.governance.adminDisbursementRelease.referenceNo}
                        </span>
                        <img
                          src={vm.governance.adminDisbursementRelease.signatureImage}
                          alt="Admin release signature"
                          className={styles.sigImg}
                        />
                        <img
                          src={vm.governance.adminDisbursementRelease.proofImage}
                          alt="Admin release proof"
                          className={styles.mediaImg}
                        />
                      </div>
                    )}
                    {vm.governance.aoDisbursementConfirmation && (
                      <div className={styles.mediaCard}>
                        <span className={styles.fieldLabel}>
                          Stage 2: AO Confirmation ({vm.governance.aoDisbursementConfirmation.signerName} • {vm.governance.aoDisbursementConfirmation.authId})
                        </span>
                        <span className={styles.recordSecondary}>
                          {vm.governance.aoDisbursementConfirmation.timestamp} • Ref: {vm.governance.aoDisbursementConfirmation.referenceNo}
                        </span>
                        <img
                          src={vm.governance.aoDisbursementConfirmation.signatureImage}
                          alt="AO confirmation signature"
                          className={styles.sigImg}
                        />
                        <img
                          src={vm.governance.aoDisbursementConfirmation.proofImage}
                          alt="AO borrower receipt proof"
                          className={styles.mediaImg}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              <SignatureGridSection
                title="Admin Committee Signatures"
                signatures={vm.signatures.adminSignatures}
                slotPrefix="Admin Sign"
              />

              {/* EXECUTED CONTRACT SNAPSHOT */}
              <div className={styles.sectionCard}>
                <div className={styles.contractSnapshotHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileCheck2 size={18} color="#B91C1C" />
                    <div>
                      <h4 className={styles.sectionTitle} style={{ margin: 0 }}>
                        Executed Contract Snapshot
                      </h4>
                      <span className={styles.recordSecondary}>
                        Immutable legal snapshot signed by borrower and officials
                      </span>
                    </div>
                  </div>
                  {vm.contract.contractTemplateSnapshot && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => setShowContractViewer(true)}
                        className={styles.contractActionBtn}
                      >
                        <Eye size={13} /> View Executed Contract
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowContractViewer(true);
                          setTimeout(() => {
                            window.print();
                          }, 300);
                        }}
                        className={styles.contractActionBtnOutline}
                      >
                        <Printer size={13} /> Print Contract
                      </button>
                    </div>
                  )}
                </div>

                {vm.contract.contractTemplateSnapshot ? (
                  <div className={styles.contractSnapshotSummaryCard}>
                    <div className={styles.contractMetaRow}>
                      <span className={styles.contractVersionBadge}>
                        TEMPLATE VERSION: {vm.contract.contractTemplateSnapshot.version}
                      </span>
                      <span className={styles.contractDateBadge}>
                        <Calendar size={12} /> Executed: {vm.contract.contractExecutedAt || vm.governance.contractExecutedAt || 'Recorded at signing'}
                      </span>
                    </div>

                    <div className={styles.contractDetailsGrid}>
                      <div>
                        <span className={styles.contractDetailLabel}>Agreement Title</span>
                        <span className={styles.contractDetailValue}>
                          {vm.contract.contractTemplateSnapshot.title || 'Microfinance Facility Agreement'}
                        </span>
                      </div>
                      <div>
                        <span className={styles.contractDetailLabel}>Template Updated Date</span>
                        <span className={styles.contractDetailValue}>
                          {vm.contract.contractTemplateSnapshot.updatedAt || 'Official Registered'}
                        </span>
                      </div>
                      <div>
                        <span className={styles.contractDetailLabel}>Final Contract Principal</span>
                        <span className={styles.contractDetailValue} style={{ color: '#B91C1C', fontWeight: '800' }}>
                          {formatPeso(vm.contract.finalContractAmount ?? vm.loan.effectivePrincipal)}
                        </span>
                      </div>
                      <div>
                        <span className={styles.contractDetailLabel}>Signer Representation</span>
                        <span className={styles.contractDetailValue}>
                          Borrower ({vm.signatures.borrowerSignatures.length || (vm.signatures.applicantSignature ? 1 : 0)} sigs) • AO • Admin
                        </span>
                      </div>
                    </div>

                    <div className={styles.contractExcerptBox}>
                      <div className={styles.contractExcerptTitle}>
                        {vm.contract.contractTemplateSnapshot.sections.promissoryTitle}
                      </div>
                      <div
                        className={styles.contractExcerptBody}
                        dangerouslySetInnerHTML={{
                          __html: interpolateContractHtml(
                            vm.contract.contractTemplateSnapshot.sections.promissoryHtml,
                            {
                              totalScheduledCollections: formatPeso(loanCalc?.totalScheduledCollections) || '₱ 0.00',
                              installmentAmount: formatPeso(loanCalc?.installmentPerFrequency) || '₱ 0.00',
                              repaymentFrequency: vm.loan.paymentMode || 'Weekly',
                              termMonths: vm.loan.termMonths || 3,
                              principal: formatPeso(vm.contract.finalContractAmount ?? vm.loan.effectivePrincipal) || '₱ 0.00',
                              borrowerName: vm.identity.borrowerName,
                              policyNo: vm.identity.policyNo || 'LCAP-001',
                            }
                          ),
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className={styles.contractUnavailableBox}>
                    <p className={styles.emptyNote}>
                      Executed contract snapshot not available for this record.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* TAB 4: PASSBOOK & LEDGER */}
          {activeTab === 'passbook' && (
            <>
              <div className={styles.summaryGrid}>
                <div className={styles.summaryCard}>
                  <span className={styles.summaryLabel}>Total Collected</span>
                  <span className={styles.summaryValue}>
                    {formatPeso(vm.ledger.totalCollected) || '₱ 0.00'}
                  </span>
                </div>
                <div className={styles.summaryCard}>
                  <span className={styles.summaryLabel}>Remaining Balance</span>
                  <span className={`${styles.summaryValue} ${styles.summaryValueAccent}`}>
                    {formatPeso(vm.ledger.remainingBalance ?? loanCalc?.contractualBalance) || 'Not available'}
                  </span>
                </div>
                <div className={styles.summaryCard}>
                  <span className={styles.summaryLabel}>CBU / Savings Balance</span>
                  <span className={styles.summaryValue}>
                    {formatPeso(vm.ledger.savingsBalance ?? loanCalc?.cbuAmount) || 'Not available'}
                  </span>
                </div>
                <div className={styles.summaryCard}>
                  <span className={styles.summaryLabel}>Next / First Due Date</span>
                  <span className={styles.summaryValue}>
                    {vm.ledger.nextDueDate || vm.ledger.firstDueDate || 'Not scheduled'}
                  </span>
                </div>
              </div>

              <div className={styles.subToggleBar}>
                <button
                  type="button"
                  onClick={() => setPassbookSubTab('booklet')}
                  className={`${styles.subToggleBtn} ${passbookSubTab === 'booklet' ? styles.subToggleBtnActive : ''}`}
                >
                  <BookOpen size={14} /> Official Passbook Booklet
                </button>
                <button
                  type="button"
                  onClick={() => setPassbookSubTab('ledger')}
                  className={`${styles.subToggleBtn} ${passbookSubTab === 'ledger' ? styles.subToggleBtnActive : ''}`}
                >
                  <FileSpreadsheet size={14} /> Loan Payment Ledger
                </button>
              </div>

              {passbookData ? (
                <div className={styles.passbookScrollWrap}>
                  {passbookSubTab === 'booklet' ? (
                    <PassbookBooklet data={passbookData} />
                  ) : (
                    <LoanPaymentLedger data={passbookData} />
                  )}
                </div>
              ) : (
                <div className={styles.sectionCard}>
                  <p className={styles.emptyNote}>Passbook and ledger data is not available for this record.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* FULL EXECUTED CONTRACT MODAL VIEWER */}
      {showContractViewer && vm.contract.contractTemplateSnapshot && (
        <div
          className={styles.contractModalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-label="Executed Contract Document"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowContractViewer(false);
          }}
        >
          <div className={styles.contractModalDialog}>
            <div className={styles.contractModalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileCheck2 size={20} color="#B91C1C" />
                <div>
                  <h3 className={styles.contractModalTitle}>
                    {vm.contract.contractTemplateSnapshot.title || 'Microfinance Facility Agreement'}
                  </h3>
                  <p className={styles.contractModalSubtitle}>
                    {vm.contract.contractTemplateSnapshot.subTitle || 'Executed Tripartite Legal Contract'}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className={styles.contractActionBtnOutline}
                >
                  <Printer size={14} /> Print Contract
                </button>
                <button
                  type="button"
                  onClick={() => setShowContractViewer(false)}
                  className={styles.contractCloseBtn}
                  aria-label="Close executed contract view"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className={styles.contractModalScroll}>
              <div className="printable-executed-contract" style={{ padding: '8px 4px', color: '#0f172a' }}>
                {/* Contract Header */}
                <div style={{ borderBottom: '2px solid #0f172a', paddingBottom: '10px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img
                      src="/tribute-credit-logo.png"
                      alt="Tribute Credit Cooperative"
                      style={{ height: '48px', width: 'auto', objectFit: 'contain' }}
                    />
                    <div>
                      <h2 style={{ fontSize: '11pt', fontWeight: '900', color: '#0f172a', margin: '0 0 2px 0', textTransform: 'uppercase' }}>
                        TRIBUTE CREDIT COOPERATIVE
                      </h2>
                      <p style={{ fontSize: '7pt', fontWeight: '800', color: '#b91c1c', margin: 0, textTransform: 'uppercase' }}>
                        MICROFINANCE PROMISSORY NOTE & CREDIT FACILITY AGREEMENT
                      </p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className={styles.contractVersionBadge}>
                      VERSION {vm.contract.contractTemplateSnapshot.version} (EXECUTED)
                    </span>
                    <span style={{ display: 'block', fontSize: '7pt', color: '#64748b', marginTop: '3px' }}>
                      Snapshot Updated: {vm.contract.contractTemplateSnapshot.updatedAt}
                    </span>
                  </div>
                </div>

                {/* Key Loan Disclosure Summary */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7.5pt', marginBottom: '12px', border: '1px solid #cbd5e1' }}>
                  <tbody>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '5px 8px', fontWeight: '700', width: '30%' }}>Borrower Name:</td>
                      <td style={{ padding: '5px 8px', width: '40%' }}>{vm.identity.borrowerName}</td>
                      <td style={{ padding: '5px 8px', fontWeight: '700', width: '15%' }}>MCID / Policy:</td>
                      <td style={{ padding: '5px 8px', width: '15%' }}>{vm.identity.mcid || vm.identity.policyNo || 'N/A'}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '5px 8px', fontWeight: '700' }}>Principal Amount:</td>
                      <td style={{ padding: '5px 8px', fontWeight: '800', color: '#b91c1c' }}>
                        {formatPeso(vm.contract.finalContractAmount ?? vm.loan.effectivePrincipal)}
                      </td>
                      <td style={{ padding: '5px 8px', fontWeight: '700' }}>Term / Mode:</td>
                      <td style={{ padding: '5px 8px' }}>
                        {vm.loan.termMonths} Months ({vm.loan.paymentMode || 'Weekly'})
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '5px 8px', fontWeight: '700' }}>Installment Due:</td>
                      <td style={{ padding: '5px 8px' }}>
                        {formatPeso(loanCalc?.installmentPerFrequency)} / {vm.loan.paymentMode || 'Weekly'}
                      </td>
                      <td style={{ padding: '5px 8px', fontWeight: '700' }}>Contract Executed:</td>
                      <td style={{ padding: '5px 8px' }}>
                        {vm.contract.contractExecutedAt || vm.governance.contractExecutedAt || 'Recorded'}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Stored Contract Sections */}
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px', fontSize: '7.5pt', lineHeight: '1.5', textAlign: 'justify', marginBottom: '14px' }}>
                  <h4 style={{ fontSize: '8.5pt', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', margin: '0 0 6px 0', borderBottom: '1px solid #cbd5e1', paddingBottom: '3px' }}>
                    {vm.contract.contractTemplateSnapshot.sections.promissoryTitle}
                  </h4>
                  <div
                    dangerouslySetInnerHTML={{
                      __html: interpolateContractHtml(
                        vm.contract.contractTemplateSnapshot.sections.promissoryHtml,
                        {
                          totalScheduledCollections: formatPeso(loanCalc?.totalScheduledCollections) || '₱ 0.00',
                          installmentAmount: formatPeso(loanCalc?.installmentPerFrequency) || '₱ 0.00',
                          repaymentFrequency: vm.loan.paymentMode || 'Weekly',
                          termMonths: vm.loan.termMonths || 3,
                          principal: formatPeso(vm.contract.finalContractAmount ?? vm.loan.effectivePrincipal) || '₱ 0.00',
                          borrowerName: vm.identity.borrowerName,
                          policyNo: vm.identity.policyNo || 'LCAP-001',
                        }
                      ),
                    }}
                  />

                  <h4 style={{ fontSize: '8.5pt', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', margin: '12px 0 6px 0', borderBottom: '1px solid #cbd5e1', paddingBottom: '3px' }}>
                    {vm.contract.contractTemplateSnapshot.sections.defaultTitle}
                  </h4>
                  <div
                    dangerouslySetInnerHTML={{
                      __html: interpolateContractHtml(
                        vm.contract.contractTemplateSnapshot.sections.defaultHtml,
                        {
                          totalScheduledCollections: formatPeso(loanCalc?.totalScheduledCollections) || '₱ 0.00',
                          installmentAmount: formatPeso(loanCalc?.installmentPerFrequency) || '₱ 0.00',
                          repaymentFrequency: vm.loan.paymentMode || 'Weekly',
                          termMonths: vm.loan.termMonths || 3,
                          principal: formatPeso(vm.contract.finalContractAmount ?? vm.loan.effectivePrincipal) || '₱ 0.00',
                          borrowerName: vm.identity.borrowerName,
                          policyNo: vm.identity.policyNo || 'LCAP-001',
                        }
                      ),
                    }}
                  />

                  <h4 style={{ fontSize: '8.5pt', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', margin: '12px 0 6px 0', borderBottom: '1px solid #cbd5e1', paddingBottom: '3px' }}>
                    {vm.contract.contractTemplateSnapshot.sections.privacyTitle}
                  </h4>
                  <div
                    dangerouslySetInnerHTML={{
                      __html: interpolateContractHtml(
                        vm.contract.contractTemplateSnapshot.sections.privacyHtml,
                        {
                          totalScheduledCollections: formatPeso(loanCalc?.totalScheduledCollections) || '₱ 0.00',
                          installmentAmount: formatPeso(loanCalc?.installmentPerFrequency) || '₱ 0.00',
                          repaymentFrequency: vm.loan.paymentMode || 'Weekly',
                          termMonths: vm.loan.termMonths || 3,
                          principal: formatPeso(vm.contract.finalContractAmount ?? vm.loan.effectivePrincipal) || '₱ 0.00',
                          borrowerName: vm.identity.borrowerName,
                          policyNo: vm.identity.policyNo || 'LCAP-001',
                        }
                      ),
                    }}
                  />

                  {vm.contract.contractTemplateSnapshot.sections.additionalClausesHtml && (
                    <>
                      <h4 style={{ fontSize: '8.5pt', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', margin: '12px 0 6px 0', borderBottom: '1px solid #cbd5e1', paddingBottom: '3px' }}>
                        ADDITIONAL MEMBER COVENANTS
                      </h4>
                      <div
                        dangerouslySetInnerHTML={{
                          __html: interpolateContractHtml(
                            vm.contract.contractTemplateSnapshot.sections.additionalClausesHtml,
                            {
                              totalScheduledCollections: formatPeso(loanCalc?.totalScheduledCollections) || '₱ 0.00',
                              installmentAmount: formatPeso(loanCalc?.installmentPerFrequency) || '₱ 0.00',
                              repaymentFrequency: vm.loan.paymentMode || 'Weekly',
                              termMonths: vm.loan.termMonths || 3,
                              principal: formatPeso(vm.contract.finalContractAmount ?? vm.loan.effectivePrincipal) || '₱ 0.00',
                              borrowerName: vm.identity.borrowerName,
                              policyNo: vm.identity.policyNo || 'LCAP-001',
                            }
                          ),
                        }}
                      />
                    </>
                  )}
                </div>

                {/* Signatures & Attestation Area */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                  <OfficialSignatureBlock
                    signature={officialAo?.signature}
                    authId={officialAo?.authId}
                    timestamp={officialAo?.timestamp}
                    signerName={officialAo?.signerName}
                    roleTitle="Account Officer Verification"
                    variant="card"
                  />
                  <OfficialSignatureBlock
                    signature={officialAdmin?.signature}
                    authId={officialAdmin?.authId}
                    timestamp={officialAdmin?.timestamp}
                    signerName={officialAdmin?.signerName}
                    roleTitle="Admin Committee Approval"
                    variant="card"
                  />
                </div>

                {/* Borrower Specimens */}
                <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px', backgroundColor: '#f8fafc' }}>
                  <div style={{ fontSize: '6.5pt', fontWeight: '800', textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>
                    Borrower Digital Stylus Signatures &amp; Verified Specimen Records
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                    {[0, 1, 2].map((idx) => {
                      const sigItem = vm.signatures.borrowerSignatures[idx];
                      const fallbackSig = idx === 0 ? vm.signatures.applicantSignature : null;
                      const sigImg = sigItem?.signature || fallbackSig;
                      const authId = sigItem?.authId;
                      const ts = sigItem?.timestamp;

                      return (
                        <div key={idx} style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '4px 6px', backgroundColor: '#ffffff', textAlign: 'center', minHeight: '60px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '5.5pt', fontWeight: '800', color: '#64748b' }}>
                            <span>Borrower Sign #{idx + 1}</span>
                            <span style={{ color: authId ? '#b91c1c' : '#94a3b8', fontFamily: 'monospace' }}>
                              {authId || 'Auth ID unavailable'}
                            </span>
                          </div>
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {sigImg ? (
                              <img src={sigImg} alt={`Borrower Sig ${idx + 1}`} style={{ maxHeight: '28px', maxWidth: '95%', objectFit: 'contain' }} />
                            ) : (
                              <span style={{ fontSize: '6.5pt', color: '#94a3b8', fontStyle: 'italic' }}>Pending Signature</span>
                            )}
                          </div>
                          <div style={{ fontSize: '5.5pt', color: '#64748b', borderTop: '1px dashed #e2e8f0', paddingTop: '1px' }}>
                            {ts || 'Pending timestamp'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
