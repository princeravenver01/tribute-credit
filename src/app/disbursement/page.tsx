'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Sidebar } from '@/components/common/Sidebar';
import { AppHeader } from '@/components/common/AppHeader';
import { SignaturePad } from '@/components/common/SignaturePad';
import { ProofCaptureInput } from '@/components/common/ProofCaptureInput';
import { AdminBorrowerDetailsModal } from '@/components/admin/AdminBorrowerDetailsModal';
import {
  getCreditAssessments,
  saveCreditAssessment,
  type CreditAssessmentItem,
} from '@/lib/credit-assessment-store';
import {
  buildAdminReleaseUpdate,
  validateAdminDisbursementRelease,
  PENDING_AO_DISBURSEMENT_LABEL,
  type DisbursementAuditRecord,
} from '@/lib/disbursement-workflow';
import { calculateTributeLoan } from '@/lib/tribute-loan-engine';
import {
  CheckCircle2,
  Clock,
  Search,
  Eye,
  ShieldCheck,
  Send,
  AlertCircle,
  PenTool,
  ArrowLeft,
} from 'lucide-react';
import theme from '@/components/admin/AdminTheme.module.css';
import styles from './disbursement.module.css';

function AuditStageCard({ title, audit }: { title: string; audit: DisbursementAuditRecord }) {
  return (
    <div className={styles.auditCard}>
      <h4 className={styles.auditCardTitle}>{title}</h4>
      <div className={styles.auditMetaRow}>
        <span>Signer</span>
        <strong>{audit.signerName}</strong>
      </div>
      <div className={styles.auditMetaRow}>
        <span>Auth ID</span>
        <strong style={{ fontFamily: 'monospace', color: '#B91C1C' }}>{audit.authId}</strong>
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
        <span className={styles.fieldLabel}>Proof of Release / Receipt</span>
        <img src={audit.proofImage} alt={`${title} proof`} className={styles.auditImg} />
      </div>
    </div>
  );
}

export default function AdminDisbursementHubPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [assessments, setAssessments] = useState<CreditAssessmentItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'ready' | 'awaiting_ao' | 'disbursed' | 'all'>('ready');
  const [showDossier, setShowDossier] = useState(false);

  // Stage 1 Admin Release form state
  const [adminSignerName, setAdminSignerName] = useState('Administrator');
  const [releaseRefNo, setReleaseRefNo] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [adminSignature, setAdminSignature] = useState('');
  const [adminProof, setAdminProof] = useState('');
  const [adminProofFileName, setAdminProofFileName] = useState<string | undefined>(undefined);
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
        if (prev && list.some((a) => a.id === prev)) return prev;
        const firstReady =
          list.find((a) => a.status === 'contract_ready') ||
          list.find((a) => a.status === 'pending_ao_disbursement') ||
          list.find((a) => a.status === 'disbursed') ||
          null;
        return firstReady ? firstReady.id : null;
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
  const effectiveReleaseRefNo =
    releaseRefNo ||
    (selectedApp
      ? `REL-${(selectedApp.applicationId || selectedApp.id).replace(/[^A-Z0-9]/gi, '').slice(-8)}`
      : '');

  const handleSelectApp = (app: CreditAssessmentItem) => {
    setSelectedId(app.id);
    setReleaseRefNo(`REL-${(app.applicationId || app.id).replace(/[^A-Z0-9]/gi, '').slice(-8)}`);
    setReleaseNotes(
      `Admin released funds via ${
        app.disbursementMode === 'online' ? app.disbursementChannel || 'Online Transfer' : 'Cashier Window'
      } pending AO borrower handover confirmation.`
    );
    setAdminSignature('');
    setAdminProof('');
    setAdminProofFileName(undefined);
    setErrorMsg('');
    setSuccessMsg('');
  };

  const readyCount = assessments.filter((a) => a.status === 'contract_ready').length;
  const awaitingAoCount = assessments.filter((a) => a.status === 'pending_ao_disbursement').length;
  const disbursedCount = assessments.filter((a) => a.status === 'disbursed').length;
  const totalDisbursedAmount = assessments
    .filter((a) => a.status === 'disbursed')
    .reduce((sum, a) => sum + (a.finalContractAmount || a.adminApprovedAmount || 0), 0);

  const filteredList = assessments.filter((a) => {
    const q = searchQuery.toLowerCase();
    const matches =
      a.borrowerName.toLowerCase().includes(q) ||
      a.id.toLowerCase().includes(q) ||
      (a.applicationId || '').toLowerCase().includes(q) ||
      (a.policyNo || '').toLowerCase().includes(q);
    if (!matches) return false;
    if (activeTab === 'ready') return a.status === 'contract_ready';
    if (activeTab === 'awaiting_ao') return a.status === 'pending_ao_disbursement';
    if (activeTab === 'disbursed') return a.status === 'disbursed';
    return (
      a.status === 'contract_ready' ||
      a.status === 'pending_ao_disbursement' ||
      a.status === 'disbursed'
    );
  });

  const selectedPrincipal = selectedApp
    ? selectedApp.finalContractAmount || selectedApp.adminApprovedAmount || selectedApp.officerAdjustedAmount || selectedApp.requestedAmount
    : 0;
  const selectedCalc = selectedApp
    ? calculateTributeLoan(selectedPrincipal, selectedApp.termMonths, selectedApp.productName, selectedApp.paymentMode)
    : null;

  const validation = selectedApp
    ? validateAdminDisbursementRelease(selectedApp, {
        signerName: adminSignerName,
        signatureImage: adminSignature,
        proofImage: adminProof,
        proofFileName: adminProofFileName,
        referenceNo: effectiveReleaseRefNo,
        notes: releaseNotes,
      })
    : { ok: false, error: 'Select a contract-ready loan.' };

  const handleSubmitAdminRelease = async () => {
    if (!selectedApp || isSubmitting) return;
    setErrorMsg('');
    setSuccessMsg('');

    const check = validateAdminDisbursementRelease(selectedApp, {
      signerName: adminSignerName,
      signatureImage: adminSignature,
      proofImage: adminProof,
      proofFileName: adminProofFileName,
      referenceNo: effectiveReleaseRefNo,
      notes: releaseNotes,
    });
    if (!check.ok) {
      setErrorMsg(check.error || 'Please complete Admin signature and proof of release.');
      return;
    }

    setIsSubmitting(true);
    try {
      const updatedRecord = buildAdminReleaseUpdate(selectedApp, {
        signerName: adminSignerName,
        signatureImage: adminSignature,
        proofImage: adminProof,
        proofFileName: adminProofFileName,
        referenceNo: effectiveReleaseRefNo,
        notes: releaseNotes,
      });

      const updatedList = saveCreditAssessment(updatedRecord);
      await fetch('/api/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedRecord),
      });

      setAssessments(updatedList);
      setAdminSignature('');
      setAdminProof('');
      setAdminProofFileName(undefined);
      setSuccessMsg(
        `Stage 1 complete: Funds released by Admin for ${selectedApp.borrowerName}. Status is now "${PENDING_AO_DISBURSEMENT_LABEL}". Loan will become disbursed only after AO confirms borrower receipt.`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to record Admin fund release.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`${theme.adminThemeRoot} ${theme.adminPageShell}`}>
      <Sidebar
        role="admin"
        userName="Administrator"
        isMobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onOpenMobile={() => setMobileMenuOpen(true)}
      />

      <main
        className={`officer-main-content ${theme.adminMainContent}`}
        style={{ flex: 1, padding: '24px 32px', overflowY: 'auto', paddingBottom: '90px' }}
      >
        <AppHeader
          panelType="admin"
          userName="Administrator"
          badgeLabel="Admin Disbursement Hub"
          pageTitle="Admin Disbursement Hub (Stage 1 Release)"
          pageSubtitle="Verify signed contracts, affix Admin digital signature & release proof, and hand off to Account Officer for final borrower confirmation."
          onOpenMobileSidebar={() => setMobileMenuOpen((prev) => !prev)}
          actions={
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
                gap: '6px',
              }}
            >
              <ArrowLeft size={14} /> Back to Dashboard
            </Link>
          }
        />

        {/* Stats Strip */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Ready for Admin Release</span>
            <span className={styles.statValue}>{readyCount}</span>
            <span className={styles.statSub}>Signed contracts (`contract_ready`)</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Awaiting AO Confirmation</span>
            <span className={styles.statValue} style={{ color: '#B91C1C' }}>{awaitingAoCount}</span>
            <span className={styles.statSub}>Released by Admin, not yet disbursed</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Confirmed Disbursed</span>
            <span className={styles.statValue} style={{ color: '#15803D' }}>{disbursedCount}</span>
            <span className={styles.statSub}>AO receipt confirmed</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Total Confirmed Disbursed</span>
            <span className={styles.statValue}>₱ {totalDisbursedAmount.toLocaleString('en-PH')}</span>
            <span className={styles.statSub}>Counted strictly after AO confirmation</span>
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
                aria-label="Search disbursement queue"
              />
            </div>

            <div className={styles.tabBar}>
              <button
                type="button"
                onClick={() => setActiveTab('ready')}
                className={`${styles.tabBtn} ${activeTab === 'ready' ? styles.tabBtnActive : ''}`}
              >
                <span>Ready</span>
                <span className={styles.tabCount}>{readyCount}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('awaiting_ao')}
                className={`${styles.tabBtn} ${activeTab === 'awaiting_ao' ? styles.tabBtnActive : ''}`}
              >
                <span>Awaiting AO</span>
                <span className={styles.tabCount}>{awaitingAoCount}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('disbursed')}
                className={`${styles.tabBtn} ${activeTab === 'disbursed' ? styles.tabBtnActive : ''}`}
              >
                <span>Disbursed</span>
                <span className={styles.tabCount}>{disbursedCount}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`${styles.tabBtn} ${activeTab === 'all' ? styles.tabBtnActive : ''}`}
              >
                <span>All</span>
                <span className={styles.tabCount}>{readyCount + awaitingAoCount + disbursedCount}</span>
              </button>
            </div>

            <div className={styles.queueList}>
              {filteredList.length === 0 ? (
                <div className={styles.emptyState}>No loans in this disbursement stage.</div>
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
                        {app.status === 'contract_ready' && (
                          <span className={styles.badgeReady}>Ready for Release</span>
                        )}
                        {app.status === 'pending_ao_disbursement' && (
                          <span className={styles.badgeAwaitingAo}>Awaiting AO</span>
                        )}
                        {app.status === 'disbursed' && (
                          <span className={styles.badgeDisbursed}>Disbursed</span>
                        )}
                      </div>
                      <div className={styles.queueCardBottom}>
                        <span>{app.productName} ({app.termMonths} mos)</span>
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
                    {selectedApp.disbursementMode === 'online'
                      ? `Online (${selectedApp.disbursementChannel || 'Channel'} - ${selectedApp.disbursementAccountNumber || 'Account'})`
                      : 'Over-the-Counter Cash'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDossier(true)}
                  className={styles.dossierBtn}
                >
                  <Eye size={14} /> View Full Borrower Dossier
                </button>
              </div>

              <div className={styles.proceedsGrid}>
                <div className={styles.proceedsBox}>
                  <span className={styles.proceedsLabel}>Contract Principal</span>
                  <span className={styles.proceedsAmount}>
                    ₱ {selectedPrincipal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className={styles.proceedsBox}>
                  <span className={styles.proceedsLabel}>Upfront Fees &amp; CBU</span>
                  <span className={styles.proceedsAmount}>
                    ₱ {(selectedCalc.serviceCharge + selectedCalc.cbuAmount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className={`${styles.proceedsBox} ${styles.proceedsHighlight}`}>
                  <span className={styles.proceedsLabel}>Net Cash Proceeds to Release</span>
                  <span className={styles.proceedsAmount}>
                    ₱ {selectedCalc.netCashProceeds.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* STAGE 1 FORM: Only when status === contract_ready */}
              {selectedApp.status === 'contract_ready' && (
                <div className={styles.stageCard}>
                  <h3 className={styles.stageTitle}>
                    <ShieldCheck size={18} color="#B91C1C" /> Stage 1: Admin Fund Release Authorization
                  </h3>

                  <div className={styles.formGrid}>
                    <div>
                      <label htmlFor="admin-signer-name" className={styles.fieldLabel}>
                        Releasing Administrator Name
                      </label>
                      <input
                        id="admin-signer-name"
                        type="text"
                        value={adminSignerName}
                        onChange={(e) => setAdminSignerName(e.target.value)}
                        className={styles.textInput}
                      />
                    </div>
                    <div>
                      <label htmlFor="admin-release-ref" className={styles.fieldLabel}>
                        Release Voucher / Transfer Reference No.
                      </label>
                      <input
                        id="admin-release-ref"
                        type="text"
                        value={effectiveReleaseRefNo}
                        onChange={(e) => setReleaseRefNo(e.target.value)}
                        placeholder="e.g., REL-2026-001 or GCash Ref"
                        className={styles.textInput}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="admin-release-notes" className={styles.fieldLabel}>
                      Admin Release Notes
                    </label>
                    <textarea
                      id="admin-release-notes"
                      rows={2}
                      value={releaseNotes}
                      onChange={(e) => setReleaseNotes(e.target.value)}
                      className={styles.textArea}
                    />
                  </div>

                  <div className={styles.sigSection}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className={styles.fieldLabel} style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <PenTool size={14} color="#B91C1C" /> Admin Digital Signature (Required)
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: adminSignature ? '#15803D' : '#B45309' }}>
                        {adminSignature ? '✓ Signature Captured' : 'Required'}
                      </span>
                    </div>
                    {adminSignature ? (
                      <div className={styles.sigPreviewRow}>
                        <img src={adminSignature} alt="Admin release signature" className={styles.sigPreviewImg} />
                        <button
                          type="button"
                          onClick={() => setAdminSignature('')}
                          className={styles.dossierBtn}
                        >
                          Re-sign
                        </button>
                      </div>
                    ) : (
                      <SignaturePad
                        key={`admin-disb-sig-${selectedApp.id}`}
                        onSave={(url) => setAdminSignature(url)}
                        height={120}
                      />
                    )}
                  </div>

                  <ProofCaptureInput
                    label="Proof of Admin Fund Release (Photo or Receipt — Required)"
                    helperText="Upload a transfer screenshot/receipt or capture a photo of the cash release voucher."
                    value={adminProof}
                    fileName={adminProofFileName}
                    accent="admin"
                    onChange={(url, name) => {
                      setAdminProof(url);
                      setAdminProofFileName(name);
                    }}
                  />

                  <button
                    type="button"
                    disabled={!validation.ok || isSubmitting}
                    onClick={handleSubmitAdminRelease}
                    className={styles.submitBtn}
                  >
                    <Send size={16} />
                    {isSubmitting
                      ? 'Recording Admin Release...'
                      : 'Release Funds to Account Officer (Stage 1)'}
                  </button>
                </div>
              )}

              {/* STAGE 1 LOCKED: Pending AO Confirmation */}
              {selectedApp.status === 'pending_ao_disbursement' && (
                <div className={styles.stageCard}>
                  <div className={styles.alertError} style={{ marginBottom: 0, backgroundColor: '#FFFBEB', borderColor: '#FDE68A', color: '#92400E' }}>
                    <Clock size={18} />
                    <span>
                      <strong>{PENDING_AO_DISBURSEMENT_LABEL}.</strong> Admin release is locked. The loan will become active &amp; disbursed only after the Account Officer submits Stage 2 borrower receipt proof and signature.
                    </span>
                  </div>
                  {selectedApp.adminDisbursementRelease && (
                    <div className={styles.auditGrid}>
                      <AuditStageCard
                        title="Stage 1 — Admin Release Audit"
                        audit={selectedApp.adminDisbursementRelease}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* COMPLETED: Disbursed (Both Stages Preserved) */}
              {selectedApp.status === 'disbursed' && (
                <div className={styles.stageCard} style={{ borderColor: '#86EFAC' }}>
                  <div className={styles.alertSuccess} style={{ marginBottom: 0 }}>
                    <CheckCircle2 size={18} />
                    <span>
                      Disbursement complete! Both Admin Release and AO Borrower Handover Confirmation are verified. Disbursed at: <strong>{selectedApp.disbursedAt || 'Recorded'}</strong>.
                    </span>
                  </div>
                  <div className={styles.auditGrid}>
                    {selectedApp.adminDisbursementRelease && (
                      <AuditStageCard
                        title="Stage 1 — Admin Release Audit"
                        audit={selectedApp.adminDisbursementRelease}
                      />
                    )}
                    {selectedApp.aoDisbursementConfirmation && (
                      <AuditStageCard
                        title="Stage 2 — AO Borrower Receipt Audit"
                        audit={selectedApp.aoDisbursementConfirmation}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className={styles.detailPanel}>
              <div className={styles.emptyState}>
                Select a contract-ready loan from the left queue to execute Stage 1 Admin Release.
              </div>
            </div>
          )}
        </div>
      </main>

      <AdminBorrowerDetailsModal
        borrower={showDossier ? selectedApp : null}
        onClose={() => setShowDossier(false)}
      />
    </div>
  );
}
