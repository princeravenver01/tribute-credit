'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { OfficerSidebar } from '@/components/officer/OfficerSidebar';
import { OfficerMobileNav } from '@/components/officer/OfficerMobileNav';
import { AppHeader } from '@/components/common/AppHeader';
import { SignaturePad } from '@/components/common/SignaturePad';
import { ProofCaptureInput } from '@/components/common/ProofCaptureInput';
import {
  getCreditAssessments,
  saveCreditAssessment,
  type CreditAssessmentItem,
} from '@/lib/credit-assessment-store';
import {
  buildAoConfirmationUpdate,
  validateAoDisbursementConfirmation,
  PENDING_AO_DISBURSEMENT_LABEL,
  type DisbursementAuditRecord,
} from '@/lib/disbursement-workflow';
import { calculateTributeLoan } from '@/lib/tribute-loan-engine';
import { generateCollectionScheduleDates } from '@/lib/ph-holidays';
import {
  CheckCircle2,
  Search,
  AlertCircle,
  PenTool,
  ShieldCheck,
  Users2,
} from 'lucide-react';
import theme from '@/components/officer/OfficerTheme.module.css';
import styles from './disbursements.module.css';

function AuditCard({ title, audit }: { title: string; audit: DisbursementAuditRecord }) {
  return (
    <div className={styles.auditCard}>
      <h4 className={styles.auditCardTitle}>{title}</h4>
      <div className={styles.auditMetaRow}>
        <span>Signer</span>
        <strong>{audit.signerName}</strong>
      </div>
      <div className={styles.auditMetaRow}>
        <span>Auth ID</span>
        <strong style={{ fontFamily: 'monospace', color: '#15803D' }}>{audit.authId}</strong>
      </div>
      <div className={styles.auditMetaRow}>
        <span>Timestamp</span>
        <strong>{audit.timestamp}</strong>
      </div>
      <div className={styles.auditMetaRow}>
        <span>Reference No.</span>
        <strong style={{ fontFamily: 'monospace' }}>{audit.referenceNo}</strong>
      </div>
      {audit.notes && (
        <div style={{ fontSize: '12px', color: '#334155', fontStyle: 'italic' }}>
          &ldquo;{audit.notes}&rdquo;
        </div>
      )}
      <div>
        <span className={styles.fieldLabel}>Digital Signature</span>
        <img src={audit.signatureImage} alt={`${title} signature`} className={styles.auditImg} style={{ maxHeight: '72px' }} />
      </div>
      <div>
        <span className={styles.fieldLabel}>Proof Photo / Receipt</span>
        <img src={audit.proofImage} alt={`${title} proof`} className={styles.auditImg} />
      </div>
    </div>
  );
}

export default function OfficerDisbursementsPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [assessments, setAssessments] = useState<CreditAssessmentItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'pending_ao' | 'disbursed'>('pending_ao');

  // Stage 2 AO Confirmation state
  const [aoSignerName, setAoSignerName] = useState('Officer Juan (AO-001)');
  const [aoRefNo, setAoRefNo] = useState('');
  const [aoNotes, setAoNotes] = useState('');
  const [aoSignature, setAoSignature] = useState('');
  const [aoProof, setAoProof] = useState('');
  const [aoProofFileName, setAoProofFileName] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const loadData = async () => {
      const list = getCreditAssessments();

      try {
        const res = await fetch('/api/assessments');
        if (res.ok) {
          const json = await res.json();
          if (json.data && Array.isArray(json.data)) {
            for (const serverItem of json.data) {
              const localIdx = list.findIndex(
                (a) =>
                  a.id === serverItem.id ||
                  (serverItem.applicationId && a.applicationId === serverItem.applicationId)
              );
              if (localIdx >= 0) {
                const local = list[localIdx];
                list[localIdx] = {
                  ...local,
                  ...serverItem,
                  adminDisbursementRelease: local.adminDisbursementRelease || serverItem.adminDisbursementRelease,
                  aoDisbursementConfirmation: local.aoDisbursementConfirmation || serverItem.aoDisbursementConfirmation,
                };
              } else {
                list.unshift(serverItem);
              }
            }
          }
        }
      } catch {}

      setAssessments([...list]);
      setSelectedId((prev) => {
        if (prev && list.some((a) => a.id === prev && (a.status === 'pending_ao_disbursement' || a.status === 'disbursed'))) {
          return prev;
        }
        const firstPending =
          list.find((a) => a.status === 'pending_ao_disbursement') ||
          list.find((a) => a.status === 'disbursed') ||
          null;
        return firstPending ? firstPending.id : null;
      });
    };

    void loadData();
    window.addEventListener('storage', loadData);
    const poller = setInterval(loadData, 2000);
    return () => {
      window.removeEventListener('storage', loadData);
      clearInterval(poller);
    };
  }, []);

  const selectedApp = selectedId ? assessments.find((a) => a.id === selectedId) || null : null;

  const handleSelectApp = (app: CreditAssessmentItem) => {
    setSelectedId(app.id);
    setAoSignerName(app.evaluatedByOfficer || 'Officer Juan (AO-001)');
    setAoRefNo(app.adminDisbursementRelease?.referenceNo || app.disbursementReferenceNo || '');
    setAoNotes('Funds handed over and verified received by borrower.');
    setAoSignature('');
    setAoProof('');
    setAoProofFileName(undefined);
    setErrorMsg('');
    setSuccessMsg('');
  };

  // ONLY records released by Admin appear in pending confirmation queue
  const awaitingAoList = assessments.filter((a) => a.status === 'pending_ao_disbursement');
  const disbursedList = assessments.filter((a) => a.status === 'disbursed');

  const filteredList = (activeTab === 'pending_ao' ? awaitingAoList : disbursedList).filter((a) => {
    const q = searchQuery.toLowerCase();
    return (
      a.borrowerName.toLowerCase().includes(q) ||
      a.id.toLowerCase().includes(q) ||
      (a.applicationId || '').toLowerCase().includes(q) ||
      (a.policyNo || '').toLowerCase().includes(q)
    );
  });

  const selectedPrincipal = selectedApp
    ? selectedApp.finalContractAmount || selectedApp.adminApprovedAmount || selectedApp.officerAdjustedAmount || selectedApp.requestedAmount
    : 0;
  const selectedCalc = selectedApp
    ? calculateTributeLoan(selectedPrincipal, selectedApp.termMonths, selectedApp.productName, selectedApp.paymentMode)
    : null;

  const validation = selectedApp
    ? validateAoDisbursementConfirmation(selectedApp, {
        signerName: aoSignerName,
        signatureImage: aoSignature,
        proofImage: aoProof,
        proofFileName: aoProofFileName,
        referenceNo: aoRefNo,
        notes: aoNotes,
      })
    : { ok: false, error: 'Select a loan awaiting AO confirmation.' };

  const handleConfirmBorrowerReceipt = async () => {
    if (!selectedApp || !selectedCalc || isSubmitting) return;
    setErrorMsg('');
    setSuccessMsg('');

    const check = validateAoDisbursementConfirmation(selectedApp, {
      signerName: aoSignerName,
      signatureImage: aoSignature,
      proofImage: aoProof,
      proofFileName: aoProofFileName,
      referenceNo: aoRefNo,
      notes: aoNotes,
    });
    if (!check.ok) {
      setErrorMsg(check.error || 'Please complete AO signature and proof of borrower receipt.');
      return;
    }

    setIsSubmitting(true);
    try {
      const sched = generateCollectionScheduleDates(
        new Date(),
        selectedApp.termMonths || 3,
        selectedApp.paymentMode || 'Weekly'
      );
      const firstDueDate = sched[0]?.dateStr;

      const updatedRecord = buildAoConfirmationUpdate(
        selectedApp,
        {
          signerName: aoSignerName,
          signatureImage: aoSignature,
          proofImage: aoProof,
          proofFileName: aoProofFileName,
          referenceNo: aoRefNo,
          notes: aoNotes,
        },
        {
          totalScheduledCollections: selectedCalc.totalScheduledCollections,
          firstDueDate,
          nextDueDate: firstDueDate,
        }
      );

      const updatedList = saveCreditAssessment(updatedRecord);
      await fetch('/api/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedRecord),
      });

      setAssessments(updatedList);
      setAoSignature('');
      setAoProof('');
      setAoProofFileName(undefined);
      setSuccessMsg(
        `Disbursement finalized for ${selectedApp.borrowerName}! The loan is now marked Disbursed and its repayment ledger is active in Current Borrowers.`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to confirm borrower disbursement receipt.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`${theme.theme} ${theme.pageShell}`}>
      <OfficerSidebar isMobileOpen={mobileMenuOpen} onCloseMobile={() => setMobileMenuOpen(false)} />

      <main className={`officer-main-content ${theme.main}`}>
        <AppHeader
          panelType="officer"
          userName="Officer Juan"
          badgeLabel="Stage 2 Handover Desk"
          pageTitle="AO Disbursements (Borrower Receipt Confirmation)"
          pageSubtitle="Confirm funds released by Admin with your AO digital signature and borrower handover photo/receipt to activate the loan ledger."
          onOpenMobileSidebar={() => setMobileMenuOpen((prev) => !prev)}
          actions={
            <Link href="/officer/borrowers" className={styles.secondaryBtn}>
              <Users2 size={14} /> Current Borrowers
            </Link>
          }
        />

        {/* Stats Strip */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Awaiting AO Confirmation</span>
            <span className={styles.statValue} style={{ color: '#B45309' }}>{awaitingAoList.length}</span>
            <span className={styles.statSub}>{PENDING_AO_DISBURSEMENT_LABEL}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Confirmed &amp; Disbursed</span>
            <span className={styles.statValue} style={{ color: '#15803D' }}>{disbursedList.length}</span>
            <span className={styles.statSub}>Active repayment ledgers started</span>
          </div>
        </div>

        {successMsg && (
          <div className={styles.alertSuccess} role="status">
            <CheckCircle2 size={18} />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className={styles.alertError} role="alert">
            <AlertCircle size={18} />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className={styles.layoutGrid}>
          {/* Left Queue */}
          <div className={styles.queueColumn}>
            <div className={styles.searchWrap}>
              <Search size={15} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search borrower, Loan ID, or policy..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
                aria-label="Search AO disbursements"
              />
            </div>

            <div className={styles.tabBar}>
              <button
                type="button"
                onClick={() => setActiveTab('pending_ao')}
                className={`${styles.tabBtn} ${activeTab === 'pending_ao' ? styles.tabBtnActive : ''}`}
              >
                <span>Awaiting AO</span>
                <span className={styles.tabCount}>{awaitingAoList.length}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('disbursed')}
                className={`${styles.tabBtn} ${activeTab === 'disbursed' ? styles.tabBtnActive : ''}`}
              >
                <span>Disbursed</span>
                <span className={styles.tabCount}>{disbursedList.length}</span>
              </button>
            </div>

            <div className={styles.queueList}>
              {filteredList.length === 0 ? (
                <div className={styles.emptyState}>
                  {activeTab === 'pending_ao'
                    ? 'No Admin-released loans awaiting AO confirmation right now.'
                    : 'No confirmed disbursed loans yet.'}
                </div>
              ) : (
                filteredList.map((app) => {
                  const isActive = selectedApp?.id === app.id;
                  const amt = app.finalContractAmount || app.adminApprovedAmount || app.requestedAmount;
                  return (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => handleSelectApp(app)}
                      className={`${styles.queueCard} ${isActive ? styles.queueCardActive : ''}`}
                    >
                      <div className={styles.queueCardTop}>
                        <div>
                          <h3 className={styles.borrowerTitle}>{app.borrowerName}</h3>
                          <span className={styles.monoMeta}>
                            {app.applicationId || app.id} • {app.policyNo}
                          </span>
                        </div>
                        {app.status === 'pending_ao_disbursement' ? (
                          <span className={styles.badgeAwaiting}>Awaiting AO</span>
                        ) : (
                          <span className={styles.badgeDisbursed}>Disbursed</span>
                        )}
                      </div>
                      <div className={styles.queueCardBottom}>
                        <span>{app.productName}</span>
                        <strong>₱ {(Number(amt) || 0).toLocaleString('en-PH')}</strong>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Workspace */}
          {selectedApp && selectedCalc ? (
            <div className={styles.detailPanel}>
              <div className={styles.detailHeader}>
                <div>
                  <h2 className={styles.detailName}>{selectedApp.borrowerName}</h2>
                  <p className={styles.detailMeta}>
                    {selectedApp.applicationId || selectedApp.id} • {selectedApp.policyNo} •{' '}
                    {selectedApp.status === 'pending_ao_disbursement'
                      ? PENDING_AO_DISBURSEMENT_LABEL
                      : `Disbursed (${selectedApp.disbursedAt || 'Confirmed'})`}
                  </p>
                </div>
                {selectedApp.status === 'disbursed' && (
                  <Link
                    href={`/officer/borrowers?viewPassbook=${encodeURIComponent(selectedApp.id)}`}
                    className={styles.secondaryBtn}
                  >
                    Open Passbook &amp; Ledger
                  </Link>
                )}
              </div>

              <div className={styles.proceedsGrid}>
                <div className={styles.proceedsBox}>
                  <span className={styles.proceedsLabel}>Contract Principal</span>
                  <span className={styles.proceedsAmount}>
                    ₱ {selectedPrincipal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className={`${styles.proceedsBox} ${styles.proceedsHighlight}`}>
                  <span className={styles.proceedsLabel}>Net Cash Proceeds</span>
                  <span className={styles.proceedsAmount}>
                    ₱ {selectedCalc.netCashProceeds.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className={styles.proceedsBox}>
                  <span className={styles.proceedsLabel}>Total Scheduled Collections</span>
                  <span className={styles.proceedsAmount}>
                    ₱ {selectedCalc.totalScheduledCollections.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Read-only Stage 1 Admin Release Evidence */}
              {selectedApp.adminDisbursementRelease && (
                <div className={styles.auditGrid}>
                  <AuditCard
                    title="Stage 1 — Admin Release Evidence (Verified)"
                    audit={selectedApp.adminDisbursementRelease}
                  />
                  {selectedApp.aoDisbursementConfirmation && (
                    <AuditCard
                      title="Stage 2 — AO Borrower Receipt Evidence (Verified)"
                      audit={selectedApp.aoDisbursementConfirmation}
                    />
                  )}
                </div>
              )}

              {/* STAGE 2 FORM: Only when status === pending_ao_disbursement */}
              {selectedApp.status === 'pending_ao_disbursement' && (
                <div className={styles.stageCard}>
                  <h3 className={styles.stageTitle}>
                    <ShieldCheck size={18} color="#15803D" /> Stage 2: Account Officer Final Handover Confirmation
                  </h3>

                  <div className={styles.formGrid}>
                    <div>
                      <label htmlFor="ao-signer-name" className={styles.fieldLabel}>
                        Confirming Account Officer Name
                      </label>
                      <input
                        id="ao-signer-name"
                        type="text"
                        value={aoSignerName}
                        onChange={(e) => setAoSignerName(e.target.value)}
                        className={styles.textInput}
                      />
                    </div>
                    <div>
                      <label htmlFor="ao-confirm-ref" className={styles.fieldLabel}>
                        Handover Reference / Receipt No.
                      </label>
                      <input
                        id="ao-confirm-ref"
                        type="text"
                        value={aoRefNo}
                        onChange={(e) => setAoRefNo(e.target.value)}
                        placeholder="Optional override or Admin release ref"
                        className={styles.textInput}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="ao-confirm-notes" className={styles.fieldLabel}>
                      Borrower Handover Confirmation Notes
                    </label>
                    <textarea
                      id="ao-confirm-notes"
                      rows={2}
                      value={aoNotes}
                      onChange={(e) => setAoNotes(e.target.value)}
                      className={styles.textArea}
                    />
                  </div>

                  <div className={styles.sigSection}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className={styles.fieldLabel} style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <PenTool size={14} color="#15803D" /> Account Officer Digital Signature (Required)
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: aoSignature ? '#15803D' : '#B45309' }}>
                        {aoSignature ? '✓ Signature Captured' : 'Required'}
                      </span>
                    </div>
                    {aoSignature ? (
                      <div className={styles.sigPreviewRow}>
                        <img src={aoSignature} alt="AO confirmation signature" className={styles.sigPreviewImg} />
                        <button
                          type="button"
                          onClick={() => setAoSignature('')}
                          className={styles.secondaryBtn}
                        >
                          Re-sign
                        </button>
                      </div>
                    ) : (
                      <SignaturePad
                        key={`ao-disb-sig-${selectedApp.id}`}
                        onSave={(url) => setAoSignature(url)}
                        height={120}
                      />
                    )}
                  </div>

                  <ProofCaptureInput
                    label="Proof of Borrower Receipt of Funds (Photo or Receipt — Required)"
                    helperText="Upload or capture a photo of the borrower receiving the proceeds or signed acknowledgment receipt."
                    value={aoProof}
                    fileName={aoProofFileName}
                    accent="officer"
                    onChange={(url, name) => {
                      setAoProof(url);
                      setAoProofFileName(name);
                    }}
                  />

                  <button
                    type="button"
                    disabled={!validation.ok || isSubmitting}
                    onClick={handleConfirmBorrowerReceipt}
                    className={styles.submitBtn}
                  >
                    <CheckCircle2 size={16} />
                    {isSubmitting
                      ? 'Finalizing Disbursement...'
                      : 'Confirm Borrower Received Funds & Mark Disbursed'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className={styles.detailPanel}>
              <div className={styles.emptyState}>
                Select an Admin-released loan from the left queue to confirm borrower receipt.
              </div>
            </div>
          )}
        </div>
      </main>

      <OfficerMobileNav onOpenSidebar={() => setMobileMenuOpen(true)} />
    </div>
  );
}
