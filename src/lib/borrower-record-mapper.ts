import type { CreditAssessmentItem, FiveCsScorecard } from './credit-assessment-store';
import type { DisbursementAuditRecord } from './disbursement-workflow';

export interface SignatureEntry {
  signature: string;
  authId: string | null;
  timestamp: string | null;
}

export interface GovIdEntry {
  type: string;
  number: string | null;
  expiry: string | null;
}

export interface DependantEntry {
  name: string;
  relation: string | null;
  age: string | null;
  occupation: string | null;
}

export interface AssetEntry {
  description: string;
  estimatedValue: number | null;
  status: string | null;
}

export interface OtherIncomeEntry {
  source: string;
  monthlyAmount: number | null;
}

export interface LiabilityEntry {
  creditor: string;
  monthlyPayment: number | null;
  remainingBalance: number | null;
}

export interface AttachmentEntry {
  label: string;
  name: string | null;
  url: string | null;
}

export interface CoMakerInfo {
  name: string;
  relationship: string | null;
  contact: string | null;
  incomeSource: string | null;
}

export interface NormalizedBorrowerDetails {
  identity: {
    id: string;
    loanReference: string | null;
    borrowerName: string;
    mcid: string | null;
    policyNo: string | null;
    contactNumber: string | null;
    email: string | null;
    birthDate: string | null;
    sex: string | null;
    civilStatus: string | null;
    nationality: string | null;
    spouseName: string | null;
    membershipDate: string | null;
    loanCycle: number | null;
    govIds: GovIdEntry[];
    dependants: DependantEntry[];
  };
  address: {
    fullAddress: string | null;
    addressLine1: string | null;
    barangay: string | null;
    city: string | null;
    province: string | null;
    residenceType: string | null;
  };
  livelihood: {
    occupation: string | null;
    businessName: string | null;
    businessType: string | null;
    yearsInBusiness: number | null;
    monthlyNetIncome: number | null;
    monthlyHouseholdExpenses: number | null;
    existingDebts: number | null;
    netDisposableIncome: number | null;
    assets: AssetEntry[];
    otherIncomes: OtherIncomeEntry[];
    liabilities: LiabilityEntry[];
    coMaker: CoMakerInfo | null;
  };
  loan: {
    productName: string | null;
    termMonths: number | null;
    paymentMode: CreditAssessmentItem['paymentMode'] | null;
    requestedAmount: number | null;
    aiPreApprovedAmount: number | null;
    officerAdjustedAmount: number | null;
    adminApprovedAmount: number | null;
    finalContractAmount: number | null;
    effectivePrincipal: number;
    loanPurpose: string | null;
  };
  assessment: {
    aiRiskRating: string | null;
    aiDsr: number | null;
    aiConfidenceScore: number | null;
    aiRecommendationNote: string | null;
    fiveCs: FiveCsScorecard | null;
    officerRecommendation: CreditAssessmentItem['officerRecommendation'] | null;
    officerNotes: string | null;
    evaluatedByOfficer: string | null;
    evaluatedAt: string | null;
  };
  governance: {
    status: CreditAssessmentItem['status'];
    statusLabel: string;
    adminApprovedAmount: number | null;
    previousAdminApprovedAmount: number | null;
    adjustmentCount: number;
    maxAdjustmentsReached: boolean;
    reconsiderationJustification: string | null;
    adminNotes: string | null;
    adminActionAt: string | null;
    contractExecutedAt: string | null;
    disbursementMode: CreditAssessmentItem['disbursementMode'] | null;
    disbursementChannel: string | null;
    disbursementAccountNumber: string | null;
    disbursedAt: string | null;
    disbursedBy: string | null;
    disbursementReferenceNo: string | null;
    disbursementNotes: string | null;
    adminDisbursementRelease: DisbursementAuditRecord | null;
    aoDisbursementConfirmation: DisbursementAuditRecord | null;
  };
  documents: {
    applicantFacePhoto: string | null;
    borrowerHoldingIdPhoto: string | null;
    attachments: AttachmentEntry[];
  };
  signatures: {
    applicantSignature: string | null;
    borrowerSignatures: SignatureEntry[];
    officerSignatures: SignatureEntry[];
    adminSignatures: SignatureEntry[];
  };
  contract: {
    contractTemplateSnapshot: CreditAssessmentItem['contractTemplateSnapshot'] | null;
    contractExecutedAt: string | null;
    finalContractAmount: number | null;
  };
  ledger: {
    firstDueDate: string | null;
    nextDueDate: string | null;
    totalCollected: number | null;
    remainingBalance: number | null;
    savingsBalance: number | null;
    paymentRecords: NonNullable<CreditAssessmentItem['paymentLedgerRecords']>;
    savingsRecords: NonNullable<CreditAssessmentItem['savingsLedgerRecords']>;
  };
}

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'LCAP-') return null;
  return trimmed;
}

function cleanNumber(value: unknown, allowZero = false): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  if (!allowZero && num <= 0) return null;
  return num;
}

function normalizeSignatures(
  primary?: unknown,
  fallback?: unknown
): SignatureEntry[] {
  const source = Array.isArray(primary) && primary.length > 0
    ? primary
    : Array.isArray(fallback) && fallback.length > 0
      ? fallback
      : [];

  return source
    .map((entry): SignatureEntry | null => {
      if (typeof entry === 'string') {
        const sig = cleanText(entry);
        return sig ? { signature: sig, authId: null, timestamp: null } : null;
      }
      if (entry && typeof entry === 'object') {
        const obj = entry as Record<string, unknown>;
        const sig = cleanText(obj.signature);
        if (!sig) return null;
        return {
          signature: sig,
          authId: cleanText(obj.authId),
          timestamp: cleanText(obj.timestamp),
        };
      }
      return null;
    })
    .filter((item): item is SignatureEntry => item !== null);
}

export function formatAssessmentStatusLabel(status: CreditAssessmentItem['status']): string {
  switch (status) {
    case 'pending_assessment':
      return 'Pending AO Assessment';
    case 'pending_admin':
      return 'Pending Admin Review';
    case 'admin_approved':
      return 'Admin Approved';
    case 'admin_rejected':
      return 'Declined / Rejected';
    case 'contract_ready':
      return 'Contract Executed';
    case 'pending_ao_disbursement':
      return 'Released by Admin — Awaiting AO Confirmation';
    case 'disbursed':
      return 'Disbursed / Active';
    default:
      return status;
  }
}

export function formatRecommendationLabel(
  rec: CreditAssessmentItem['officerRecommendation'] | null | undefined
): string {
  if (rec === 'recommend_approve') return 'Recommend Approval';
  if (rec === 'recommend_adjust') return 'Recommend Adjusted Amount';
  if (rec === 'recommend_reject') return 'Recommend Decline';
  return 'Not specified';
}

export function buildBorrowerDetailsViewModel(
  record: CreditAssessmentItem
): NormalizedBorrowerDetails {
  const raw = record as unknown as Record<string, unknown>;
  const profile = (record.fullProfile || {}) as Record<string, unknown>;
  const s1 = (profile.step1 || {}) as Record<string, unknown>;
  const s2 = (profile.step2 || {}) as Record<string, unknown>;
  const s4 = (profile.step4 || {}) as Record<string, unknown>;
  const s5 = (profile.step5 || {}) as Record<string, unknown>;

  // Dependants
  const rawDependants = Array.isArray(profile.dependants) ? profile.dependants : [];
  const dependants: DependantEntry[] = rawDependants
    .map((dep): DependantEntry | null => {
      if (!dep || typeof dep !== 'object') return null;
      const d = dep as Record<string, unknown>;
      const fullName = cleanText(
        [d.firstName, d.middleName, d.lastName].filter(Boolean).join(' ') || d.name
      );
      if (!fullName) return null;
      return {
        name: fullName,
        relation: cleanText(d.relation) || cleanText(d.relationship),
        age: d.age !== undefined && d.age !== null && String(d.age).trim() !== '' ? String(d.age) : null,
        occupation: cleanText(d.occupation) || cleanText(d.schoolOrWork),
      };
    })
    .filter((d): d is DependantEntry => d !== null);

  // Spouse resolution from explicit field or dependants list
  const spouseFromDependants = dependants.find((d) =>
    (d.relation || '').toLowerCase().includes('spouse') ||
    (d.relation || '').toLowerCase().includes('husband') ||
    (d.relation || '').toLowerCase().includes('wife')
  );

  // Government IDs
  const rawGovIds = Array.isArray(profile.govIds) ? profile.govIds : [];
  const govIds: GovIdEntry[] = rawGovIds
    .map((idItem): GovIdEntry | null => {
      if (!idItem || typeof idItem !== 'object') return null;
      const g = idItem as Record<string, unknown>;
      const idType = cleanText(g.type) || cleanText(g.idType) || cleanText(g.name);
      const idNum = cleanText(g.number) || cleanText(g.idNumber);
      if (!idType && !idNum) return null;
      return {
        type: idType || 'Government ID',
        number: idNum,
        expiry: cleanText(g.expiryDate) || cleanText(g.expiry),
      };
    })
    .filter((g): g is GovIdEntry => g !== null);

  if (govIds.length === 0) {
    const singleIdType = cleanText(s1.idType);
    const singleIdNum = cleanText(s1.idNumber);
    if (singleIdType || singleIdNum) {
      govIds.push({
        type: singleIdType || 'Government ID',
        number: singleIdNum,
        expiry: cleanText(s1.idExpiryDate),
      });
    }
  }

  // Address
  const addressLine1 = cleanText(s2.addressLine1);
  const barangay = cleanText(s2.barangay);
  const city = cleanText(s2.city);
  const province = cleanText(s2.province);
  const composedAddress = [addressLine1, barangay, city, province].filter(Boolean).join(', ');
  const fullAddress = composedAddress || cleanText(record.location);

  // Contact
  const composedContact = cleanText(
    s2.mobileNumber ? `${s2.countryCode || '+63'} ${s2.mobileNumber}` : null
  );
  const contactNumber = cleanText(record.contactNumber) || composedContact;
  const email = cleanText(record.borrowerEmail) || cleanText(s2.email);

  // Assets, Other Incomes, Liabilities
  const rawAssets = Array.isArray(profile.assets) ? profile.assets : [];
  const assets: AssetEntry[] = rawAssets
    .map((item): AssetEntry | null => {
      if (!item || typeof item !== 'object') return null;
      const a = item as Record<string, unknown>;
      const desc = cleanText(a.description) || cleanText(a.name) || cleanText(a.type);
      if (!desc) return null;
      return {
        description: desc,
        estimatedValue: cleanNumber(a.estimatedValue ?? a.value, true),
        status: cleanText(a.ownershipStatus) || cleanText(a.status),
      };
    })
    .filter((a): a is AssetEntry => a !== null);

  const rawOtherIncomes = Array.isArray(profile.otherIncomes) ? profile.otherIncomes : [];
  const otherIncomes: OtherIncomeEntry[] = rawOtherIncomes
    .map((item): OtherIncomeEntry | null => {
      if (!item || typeof item !== 'object') return null;
      const o = item as Record<string, unknown>;
      const src = cleanText(o.source) || cleanText(o.description);
      if (!src) return null;
      return {
        source: src,
        monthlyAmount: cleanNumber(o.monthlyAmount ?? o.amount, true),
      };
    })
    .filter((o): o is OtherIncomeEntry => o !== null);

  const rawLiabilities = Array.isArray(profile.liabilities) ? profile.liabilities : [];
  const liabilities: LiabilityEntry[] = rawLiabilities
    .map((item): LiabilityEntry | null => {
      if (!item || typeof item !== 'object') return null;
      const l = item as Record<string, unknown>;
      const creditor = cleanText(l.creditor) || cleanText(l.institution) || cleanText(l.description);
      if (!creditor) return null;
      return {
        creditor,
        monthlyPayment: cleanNumber(l.monthlyPayment ?? l.monthlyDue, true),
        remainingBalance: cleanNumber(l.remainingBalance ?? l.balance, true),
      };
    })
    .filter((l): l is LiabilityEntry => l !== null);

  // Co-Maker
  const coMakerName = cleanText(s4.coMakerName) || cleanText(raw.coMakerName);
  const coMaker: CoMakerInfo | null = coMakerName
    ? {
        name: coMakerName,
        relationship: cleanText(s4.coMakerRelationship) || cleanText(raw.coMakerRelationship),
        contact: cleanText(s4.coMakerContact) || cleanText(raw.coMakerContact),
        incomeSource: cleanText(s4.coMakerIncomeSource) || cleanText(raw.coMakerIncomeSource),
      }
    : null;

  // Attachments
  const rawAttachments = Array.isArray(profile.attachments) ? profile.attachments : [];
  const attachments: AttachmentEntry[] = rawAttachments
    .map((item): AttachmentEntry | null => {
      if (!item || typeof item !== 'object') return null;
      const att = item as Record<string, unknown>;
      const label = cleanText(att.label) || cleanText(att.type) || cleanText(att.name);
      if (!label) return null;
      return {
        label,
        name: cleanText(att.name) || cleanText(att.fileName),
        url: cleanText(att.dataUrl) || cleanText(att.url) || cleanText(att.preview),
      };
    })
    .filter((att): att is AttachmentEntry => att !== null);

  // Loan principal
  const requestedAmount = cleanNumber(record.requestedAmount);
  const aiPreApprovedAmount = cleanNumber(record.aiPreApprovedAmount);
  const officerAdjustedAmount = cleanNumber(record.officerAdjustedAmount);
  const adminApprovedAmount = cleanNumber(record.adminApprovedAmount);
  const finalContractAmount = cleanNumber(record.finalContractAmount);
  const effectivePrincipal =
    finalContractAmount ??
    adminApprovedAmount ??
    officerAdjustedAmount ??
    aiPreApprovedAmount ??
    requestedAmount ??
    0;

  return {
    identity: {
      id: record.id,
      loanReference: cleanText(record.applicationId),
      borrowerName: cleanText(record.borrowerName) || 'Unnamed Borrower',
      mcid: cleanText(record.mcid) || cleanText(record.cidNumber) || cleanText(s1.cooperativeId),
      policyNo: cleanText(record.policyNo) || cleanText(s1.tgswsPolicyNumber),
      contactNumber,
      email,
      birthDate: cleanText(s1.birthDate) || cleanText(raw.birthDate),
      sex: cleanText(s1.sex) || cleanText(raw.sex),
      civilStatus: cleanText(s1.civilStatus) || cleanText(raw.civilStatus),
      nationality: cleanText(s1.nationality),
      spouseName: cleanText(record.spouseName) || cleanText(s1.spouseName) || spouseFromDependants?.name || null,
      membershipDate: cleanText(record.membershipDate),
      loanCycle: cleanNumber(record.loanCycle),
      govIds,
      dependants,
    },
    address: {
      fullAddress,
      addressLine1,
      barangay,
      city,
      province,
      residenceType: cleanText(s2.residenceType) || cleanText(s2.housingType),
    },
    livelihood: {
      occupation: cleanText(record.livelihood) || cleanText(s4.occupation),
      businessName: cleanText(s4.businessName) || cleanText(s2.businessName) || cleanText(raw.businessName),
      businessType: cleanText(s4.businessType) || cleanText(s2.businessType) || cleanText(raw.businessType),
      yearsInBusiness: cleanNumber(record.yearsInBusiness) ?? cleanNumber(s4.yearsInLivelihood),
      monthlyNetIncome: cleanNumber(record.monthlyNetIncome) ?? cleanNumber(s4.monthlyNetIncome),
      monthlyHouseholdExpenses: cleanNumber(s4.monthlyHouseholdExpenses ?? s4.monthlyExpenses),
      existingDebts: cleanNumber(record.existingDebts, true),
      netDisposableIncome: cleanNumber(record.netDisposableIncome),
      assets,
      otherIncomes,
      liabilities,
      coMaker,
    },
    loan: {
      productName: cleanText(record.productName) || cleanText(s5.loanProduct),
      termMonths: cleanNumber(record.termMonths) ?? cleanNumber(s5.termMonths),
      paymentMode: record.paymentMode || null,
      requestedAmount,
      aiPreApprovedAmount,
      officerAdjustedAmount,
      adminApprovedAmount,
      finalContractAmount,
      effectivePrincipal,
      loanPurpose: cleanText(s5.loanPurpose) || cleanText(s5.purpose),
    },
    assessment: {
      aiRiskRating: cleanText(record.aiRiskRating),
      aiDsr: cleanNumber(record.aiDsr, true),
      aiConfidenceScore: cleanNumber(record.aiConfidenceScore),
      aiRecommendationNote: cleanText(record.aiRecommendationNote),
      fiveCs: record.fiveCs || null,
      officerRecommendation: record.officerRecommendation || null,
      officerNotes: cleanText(record.officerNotes),
      evaluatedByOfficer: cleanText(record.evaluatedByOfficer),
      evaluatedAt: cleanText(record.evaluatedAt),
    },
    governance: {
      status: record.status,
      statusLabel: formatAssessmentStatusLabel(record.status),
      adminApprovedAmount,
      previousAdminApprovedAmount: cleanNumber(record.previousAdminApprovedAmount),
      adjustmentCount: Number(record.adjustmentCount) || 0,
      maxAdjustmentsReached: Boolean(record.maxAdjustmentsReached || (Number(record.adjustmentCount) || 0) >= 3),
      reconsiderationJustification: cleanText(record.reconsiderationJustification),
      adminNotes: cleanText(record.adminNotes),
      adminActionAt: cleanText(record.adminActionAt) || cleanText(profile.adminActionAt),
      contractExecutedAt: cleanText(record.contractExecutedAt),
      disbursementMode: record.disbursementMode || null,
      disbursementChannel: cleanText(record.disbursementChannel),
      disbursementAccountNumber: cleanText(record.disbursementAccountNumber),
      disbursedAt: cleanText(record.disbursedAt),
      disbursedBy: cleanText(record.disbursedBy),
      disbursementReferenceNo: cleanText(record.disbursementReferenceNo),
      disbursementNotes: cleanText(record.disbursementNotes),
      adminDisbursementRelease: record.adminDisbursementRelease || null,
      aoDisbursementConfirmation: record.aoDisbursementConfirmation || null,
    },
    documents: {
      applicantFacePhoto:
        cleanText(record.applicantFacePhoto) ||
        cleanText(profile.applicantFacePhoto) ||
        cleanText(s1.applicantFacePhoto),
      borrowerHoldingIdPhoto:
        cleanText(record.borrowerHoldingIdPhoto) || cleanText(profile.borrowerHoldingIdPhoto),
      attachments,
    },
    signatures: {
      applicantSignature:
        cleanText(record.applicantSignature) || cleanText(profile.applicantSignature),
      borrowerSignatures: normalizeSignatures(record.borrowerSignatures, profile.borrowerSignatures),
      officerSignatures: normalizeSignatures(record.officerSignatures, profile.officerSignatures),
      adminSignatures: normalizeSignatures(record.adminSignatures, profile.adminSignatures),
    },
    contract: {
      contractTemplateSnapshot:
        record.contractTemplateSnapshot && typeof record.contractTemplateSnapshot === 'object' && 'version' in record.contractTemplateSnapshot
          ? (record.contractTemplateSnapshot as CreditAssessmentItem['contractTemplateSnapshot'])
          : profile.contractTemplateSnapshot && typeof profile.contractTemplateSnapshot === 'object' && 'version' in profile.contractTemplateSnapshot
            ? (profile.contractTemplateSnapshot as CreditAssessmentItem['contractTemplateSnapshot'])
            : null,
      contractExecutedAt: cleanText(record.contractExecutedAt) || cleanText(profile.contractExecutedAt),
      finalContractAmount: cleanNumber(record.finalContractAmount) ?? cleanNumber(profile.finalContractAmount),
    },
    ledger: {
      firstDueDate: cleanText(record.firstDueDate),
      nextDueDate: cleanText(record.nextDueDate),
      totalCollected: cleanNumber(record.totalCollected, true),
      remainingBalance: cleanNumber(record.remainingBalance, true),
      savingsBalance: cleanNumber(record.savingsBalance, true),
      paymentRecords: Array.isArray(record.paymentLedgerRecords) ? record.paymentLedgerRecords : [],
      savingsRecords: Array.isArray(record.savingsLedgerRecords) ? record.savingsLedgerRecords : [],
    },
  };
}
