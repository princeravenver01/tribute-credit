import type { CreditAssessmentItem } from './credit-assessment-store';

export const PENDING_AO_DISBURSEMENT_STATUS = 'pending_ao_disbursement' as const;
export const PENDING_AO_DISBURSEMENT_LABEL = 'Released by Admin — Awaiting AO Confirmation';

export interface DisbursementAuditRecord {
  signerName: string;
  signerRole: 'admin' | 'officer';
  signatureImage: string;
  authId: string;
  timestamp: string;
  proofImage: string;
  proofFileName?: string;
  referenceNo: string;
  notes?: string;
}

export interface AdminReleaseInput {
  signerName: string;
  signatureImage: string;
  proofImage: string;
  proofFileName?: string;
  referenceNo: string;
  notes?: string;
}

export interface AoConfirmationInput {
  signerName: string;
  signatureImage: string;
  proofImage: string;
  proofFileName?: string;
  referenceNo?: string;
  notes?: string;
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

function generateAuditAuthId(prefix: 'AUTH-DISB-ADM' | 'AUTH-DISB-AO'): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const hex = Math.random().toString(16).substring(2, 6).toUpperCase();
  return `${prefix}-${y}${m}${d}-${hex}`;
}

function formatAuditTimestamp(date = new Date()): string {
  return (
    date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' +
    date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );
}

export function validateAdminDisbursementRelease(
  record: CreditAssessmentItem | null | undefined,
  input: AdminReleaseInput
): ValidationResult {
  if (!record) {
    return { ok: false, error: 'No loan record selected for release.' };
  }
  if (record.status !== 'contract_ready') {
    if (record.status === 'pending_ao_disbursement') {
      return { ok: false, error: 'Funds have already been released by Admin and are awaiting AO confirmation.' };
    }
    if (record.status === 'disbursed') {
      return { ok: false, error: 'This loan has already been confirmed and disbursed.' };
    }
    return {
      ok: false,
      error: 'Admin disbursement release requires a signed contract in contract_ready status.',
    };
  }
  if (record.adminDisbursementRelease) {
    return { ok: false, error: 'Admin release evidence has already been recorded for this loan.' };
  }
  if (!input.signerName || !input.signerName.trim()) {
    return { ok: false, error: 'Admin signer name is required.' };
  }
  if (!input.signatureImage || !input.signatureImage.trim()) {
    return { ok: false, error: 'Admin digital signature is required before releasing funds.' };
  }
  if (!input.proofImage || !input.proofImage.trim()) {
    return { ok: false, error: 'Photo or receipt proof of Admin fund release is required.' };
  }
  if (!input.referenceNo || !input.referenceNo.trim()) {
    return { ok: false, error: 'Release voucher or transfer reference number is required.' };
  }
  return { ok: true };
}

export function buildAdminReleaseUpdate(
  record: CreditAssessmentItem,
  input: AdminReleaseInput
): CreditAssessmentItem {
  const check = validateAdminDisbursementRelease(record, input);
  if (!check.ok) {
    throw new Error(check.error || 'Invalid Admin disbursement release.');
  }

  const auditRecord: DisbursementAuditRecord = {
    signerName: input.signerName.trim(),
    signerRole: 'admin',
    signatureImage: input.signatureImage.trim(),
    authId: generateAuditAuthId('AUTH-DISB-ADM'),
    timestamp: formatAuditTimestamp(),
    proofImage: input.proofImage.trim(),
    proofFileName: input.proofFileName?.trim() || undefined,
    referenceNo: input.referenceNo.trim(),
    notes: input.notes?.trim() || undefined,
  };

  return {
    ...record,
    status: PENDING_AO_DISBURSEMENT_STATUS,
    adminDisbursementRelease: auditRecord,
    disbursementReferenceNo: auditRecord.referenceNo,
    disbursementNotes: auditRecord.notes || record.disbursementNotes,
    // Strictly do NOT set disbursedAt, disbursedBy, remainingBalance, or totalCollected yet.
    disbursedAt: undefined,
    disbursedBy: undefined,
    remainingBalance: undefined,
    totalCollected: undefined,
  };
}

export function validateAoDisbursementConfirmation(
  record: CreditAssessmentItem | null | undefined,
  input: AoConfirmationInput
): ValidationResult {
  if (!record) {
    return { ok: false, error: 'No loan record selected for AO confirmation.' };
  }
  if (record.status !== 'pending_ao_disbursement') {
    if (record.status === 'disbursed') {
      return { ok: false, error: 'This loan has already been confirmed and marked disbursed.' };
    }
    return {
      ok: false,
      error: 'AO disbursement confirmation is only allowed after Admin has released the funds.',
    };
  }
  if (
    !record.adminDisbursementRelease ||
    !record.adminDisbursementRelease.signatureImage ||
    !record.adminDisbursementRelease.proofImage
  ) {
    return {
      ok: false,
      error: 'Prior Admin release signature and proof of release are required before AO confirmation.',
    };
  }
  if (record.aoDisbursementConfirmation) {
    return { ok: false, error: 'AO disbursement confirmation has already been recorded for this loan.' };
  }
  if (!input.signerName || !input.signerName.trim()) {
    return { ok: false, error: 'Account Officer signer name is required.' };
  }
  if (!input.signatureImage || !input.signatureImage.trim()) {
    return { ok: false, error: 'Account Officer digital signature is required to confirm receipt.' };
  }
  if (!input.proofImage || !input.proofImage.trim()) {
    return { ok: false, error: 'Photo or receipt proving borrower received the funds is required.' };
  }
  return { ok: true };
}

export function buildAoConfirmationUpdate(
  record: CreditAssessmentItem,
  input: AoConfirmationInput,
  calcSummary: {
    totalScheduledCollections: number;
    firstDueDate?: string;
    nextDueDate?: string;
  }
): CreditAssessmentItem {
  const check = validateAoDisbursementConfirmation(record, input);
  if (!check.ok) {
    throw new Error(check.error || 'Invalid AO disbursement confirmation.');
  }

  const now = new Date();
  const auditRecord: DisbursementAuditRecord = {
    signerName: input.signerName.trim(),
    signerRole: 'officer',
    signatureImage: input.signatureImage.trim(),
    authId: generateAuditAuthId('AUTH-DISB-AO'),
    timestamp: formatAuditTimestamp(now),
    proofImage: input.proofImage.trim(),
    proofFileName: input.proofFileName?.trim() || undefined,
    referenceNo: input.referenceNo?.trim() || record.adminDisbursementRelease!.referenceNo,
    notes: input.notes?.trim() || undefined,
  };

  return {
    ...record,
    status: 'disbursed',
    // Preserve Stage 1 Admin evidence immutably
    adminDisbursementRelease: record.adminDisbursementRelease,
    aoDisbursementConfirmation: auditRecord,
    disbursedAt: now.toISOString().replace('T', ' ').substring(0, 16),
    disbursedBy: `${record.adminDisbursementRelease!.signerName} → Confirmed by ${auditRecord.signerName}`,
    disbursementReferenceNo: record.adminDisbursementRelease!.referenceNo,
    disbursementNotes: auditRecord.notes || record.adminDisbursementRelease!.notes || record.disbursementNotes,
    remainingBalance: calcSummary.totalScheduledCollections,
    totalCollected: 0,
    firstDueDate: calcSummary.firstDueDate || record.firstDueDate,
    nextDueDate: calcSummary.nextDueDate || record.nextDueDate,
  };
}
