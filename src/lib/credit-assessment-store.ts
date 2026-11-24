import type { DisbursementAuditRecord } from './disbursement-workflow';

// Credit Assessment Store and 5 Cs Scoring Model for Tribute Grace
// Connects Step 6 Onboarding, Dedicated Credit Assessments Desk, and Admin Approvals

export interface FiveCsScorecard {
  characterScore: number; // 0 - 20: Barangay residency, blotter check, cooperative standing
  characterNotes: string;
  capacityScore: number; // 0 - 25: Verified net disposable income, debt-to-income ratio
  capacityNotes: string;
  capitalScore: number; // 0 - 20: Declared equity, member savings, livelihood capital
  capitalNotes: string;
  collateralScore: number; // 0 - 20: Tangible assets, chattel, co-maker reliability
  collateralNotes: string;
  conditionsScore: number; // 0 - 15: Local business foot traffic, competition, stability
  conditionsNotes: string;
  totalScore: number; // 0 - 100
  riskGrade: 'Class A (Prime / Low Risk)' | 'Class B (Acceptable / Moderate Risk)' | 'Class C (High Risk / Requires Co-Maker)' | 'Class D (Reject)';
}

export interface CreditAssessmentItem {
  id: string; // e.g., 'CA-2026-0091'
  applicationId: string; // e.g., 'NBR-2026' or 'LN-2026-0091'
  borrowerName: string;
  policyNo: string;
  contactNumber: string;
  location: string;
  livelihood: string;
  yearsInBusiness: number;
  monthlyNetIncome: number;
  existingDebts: number;
  netDisposableIncome: number;
  
  // Requested Parameters
  requestedAmount: number;
  productName: string;
  termMonths: number;
  paymentMode: 'Daily' | 'Weekly' | 'Semi-Monthly' | 'Monthly';

  // AI Algorithm Evaluation
  aiPreApprovedAmount: number;
  aiRiskRating: string;
  aiDsr: number;
  aiConfidenceScore: number;
  aiRecommendationNote: string;

  // Account Officer 5 Cs & CI Assessment
  fiveCs: FiveCsScorecard;
  officerAdjustedAmount: number;
  officerRecommendation: 'recommend_approve' | 'recommend_adjust' | 'recommend_reject';
  officerNotes: string;
  evaluatedByOfficer: string;
  evaluatedAt: string;

  // Governance Pipeline
  status:
    | 'pending_assessment'
    | 'pending_admin'
    | 'admin_approved'
    | 'admin_rejected'
    | 'contract_ready'
    | 'pending_ao_disbursement'
    | 'disbursed'
    | 'completed';
  adminApprovedAmount?: number;
  previousAdminApprovedAmount?: number;
  reconsiderationJustification?: string;
  adminNotes?: string;
  adminActionAt?: string;
  adminSignatures?: {
    signature: string;
    authId: string;
    timestamp: string;
  }[];
  adjustmentCount?: number; // Tracks reconsiderations/adjustments (max 3)
  maxAdjustmentsReached?: boolean;

  // Final Execution & Borrower Portal Access
  finalContractAmount?: number;
  contractExecutedAt?: string;
  contractTemplateSnapshot?: {
    version: string;
    updatedAt: string;
    updatedBy?: string;
    title?: string;
    subTitle?: string;
    legalNotice?: string;
    sections: {
      promissoryTitle: string;
      promissoryHtml: string;
      defaultTitle: string;
      defaultHtml: string;
      privacyTitle: string;
      privacyHtml: string;
      additionalClausesHtml?: string;
    };
  };
  applicantSignature?: string;
  applicantFacePhoto?: string;
  borrowerHoldingIdPhoto?: string;
  borrowerSignatures?: {
    signature: string;
    authId: string;
    timestamp: string;
  }[];
  officerSignatures?: {
    signature: string;
    authId: string;
    timestamp: string;
  }[];
  borrowerEmail?: string;
  tempPassword?: string;
  disbursementMode?: 'cash' | 'online';
  disbursementChannel?: string; // 'Cashier Window' | 'GCash' | 'Maya' | 'BDO' | 'BPI' | 'Landbank'
  disbursementAccountNumber?: string;

  // Passbook & Member Registry
  spouseName?: string;
  membershipDate?: string;
  cidNumber?: string;
  loanCycle?: number;
  branchManagerName?: string;

  // Two-Stage Sequential Disbursement Audit (Immutable per stage)
  adminDisbursementRelease?: DisbursementAuditRecord;
  aoDisbursementConfirmation?: DisbursementAuditRecord;

  // Disbursement Officer Execution
  disbursedAt?: string;
  disbursedBy?: string;
  disbursementReferenceNo?: string;
  disbursementNotes?: string;

  // Repayment Ledger & Savings Tracking
  firstDueDate?: string;
  nextDueDate?: string;
  totalCollected?: number;
  remainingBalance?: number;
  savingsBalance?: number;
  paymentLedgerRecords?: {
    installmentNo: number;
    paymentSchedule: string;
    status: 'Paid' | 'Pending' | 'Overdue' | 'Settled' | 'Fully Paid';
    datePaid?: string;
    principalAmount: number;
    interest?: number;
    payment?: number;
    loanBalance?: number;
    aoSignature?: string;
    aoSignatureImage?: string;
    authId?: string;
    paymentMethod?: string;
    notes?: string;
  }[];
  savingsLedgerRecords?: {
    id: string;
    date: string;
    type: 'deposit' | 'withdraw';
    amount: number;
    runningBalance: number;
    referenceNo?: string;
    processedBy?: string;
    aoSignature?: string;
    aoSignatureImage?: string;
    notes?: string;
  }[];

  // Full Borrower Onboarding Profile (for comprehensive View Details Modal)
  mcid?: string; // e.g. 'TCID-A-00001'
  pendingSync?: boolean; // True when created/updated offline and not yet acknowledged by server
  fullProfile?: {
    step1?: any;
    step2?: any;
    govIds?: any[];
    dependants?: any[];
    step4?: any;
    assets?: any[];
    otherIncomes?: any[];
    liabilities?: any[];
    step5?: any;
    attachments?: any[];
  };
}

const POST_CONTRACT_STATUS_RANK: Partial<Record<CreditAssessmentItem['status'], number>> = {
  contract_ready: 1,
  pending_ao_disbursement: 2,
  disbursed: 3,
};

/**
 * Resolves records arriving from drafts, API polling, or another browser tab.
 * Once contract execution has started, stale earlier workflow states must not
 * move the loan backwards. Before that boundary, the incoming state remains
 * authoritative so reconsideration can legitimately return a loan to Admin.
 */
export function resolveAssessmentSyncStatus(
  existingStatus: CreditAssessmentItem['status'],
  incomingStatus: CreditAssessmentItem['status']
): CreditAssessmentItem['status'] {
  const existingRank = POST_CONTRACT_STATUS_RANK[existingStatus] || 0;
  const incomingRank = POST_CONTRACT_STATUS_RANK[incomingStatus] || 0;

  if (existingRank > 0 || incomingRank > 0) {
    return existingRank >= incomingRank ? existingStatus : incomingStatus;
  }

  return incomingStatus;
}

const STORAGE_KEY = 'tribute_credit_assessments_db';

/**
 * Generates the next incremental Cooperative ID (MCID).
 * Format: TCID-A-00001
 * Starts at TCID-A-00001. If it reaches 99999, it increments letter to TCID-B-00001, etc.
 */
export function generateNextCooperativeId(): string {
  if (typeof window === 'undefined') return 'TCID-A-00001';

  try {
    const list = getCreditAssessments();
    const existingCids = list
      .map(item => item.mcid || item.cidNumber || '')
      .filter(id => /^TCID-[A-Z]-\d{5}$/.test(id));

    if (existingCids.length === 0) {
      return 'TCID-A-00001';
    }

    // Sort to find the highest CID
    existingCids.sort((a, b) => {
      const seriesA = a.charAt(5);
      const seriesB = b.charAt(5);
      if (seriesA !== seriesB) {
        return seriesA.localeCompare(seriesB);
      }
      const numA = parseInt(a.slice(7), 10);
      const numB = parseInt(b.slice(7), 10);
      return numA - numB;
    });

    const latest = existingCids[existingCids.length - 1];
    let seriesChar = latest.charAt(5);
    let num = parseInt(latest.slice(7), 10);

    if (num >= 99999) {
      // Roll over to next alphabet series
      const nextCharCode = seriesChar.charCodeAt(0) + 1;
      seriesChar = String.fromCharCode(nextCharCode <= 90 ? nextCharCode : 65); // A-Z wrap
      num = 1;
    } else {
      num += 1;
    }

    const paddedNum = num.toString().padStart(5, '0');
    return `TCID-${seriesChar}-${paddedNum}`;
  } catch (e) {
    return 'TCID-A-00001';
  }
}

/**
 * Generates the next incremental Loan Reference Number.
 * Format: TC-LN-A-00001
 * Starts at TC-LN-A-00001. Increments sequentially (TC-LN-A-00002, etc.).
 */
export function generateNextLoanReference(): string {
  if (typeof window === 'undefined') return 'TC-LN-A-00001';

  try {
    const list = getCreditAssessments();
    const existingLoanRefs = list
      .map(item => item.applicationId || '')
      .filter(id => /^TC-LN-[A-Z]-\d{5}$/.test(id));

    if (existingLoanRefs.length === 0) {
      return 'TC-LN-A-00001';
    }

    existingLoanRefs.sort((a, b) => {
      const seriesA = a.charAt(6);
      const seriesB = b.charAt(6);
      if (seriesA !== seriesB) {
        return seriesA.localeCompare(seriesB);
      }
      const numA = parseInt(a.slice(8), 10);
      const numB = parseInt(b.slice(8), 10);
      return numA - numB;
    });

    const latest = existingLoanRefs[existingLoanRefs.length - 1];
    let seriesChar = latest.charAt(6);
    let num = parseInt(latest.slice(8), 10);

    if (num >= 99999) {
      const nextCharCode = seriesChar.charCodeAt(0) + 1;
      seriesChar = String.fromCharCode(nextCharCode <= 90 ? nextCharCode : 65);
      num = 1;
    } else {
      num += 1;
    }

    const paddedNum = num.toString().padStart(5, '0');
    return `TC-LN-${seriesChar}-${paddedNum}`;
  } catch (e) {
    return 'TC-LN-A-00001';
  }
}

export function calculate5CsGrade(totalScore: number): FiveCsScorecard['riskGrade'] {
  if (totalScore >= 80) return 'Class A (Prime / Low Risk)';
  if (totalScore >= 65) return 'Class B (Acceptable / Moderate Risk)';
  if (totalScore >= 50) return 'Class C (High Risk / Requires Co-Maker)';
  return 'Class D (Reject)';
}

// Blank initial assessments list (clean database state)
const INITIAL_ASSESSMENTS: CreditAssessmentItem[] = [];

export function getCreditAssessments(): CreditAssessmentItem[] {
  if (typeof window === 'undefined') return INITIAL_ASSESSMENTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_ASSESSMENTS));
      return INITIAL_ASSESSMENTS;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error loading assessments:', e);
    return INITIAL_ASSESSMENTS;
  }
}

export function clearCreditAssessments(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem('tribute_new_borrower_draft');
  try {
    fetch('/api/assessments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'clear_all' }),
    }).catch(() => {});
  } catch (e) {}
  try {
    window.dispatchEvent(new Event('storage'));
  } catch (e) {}
}

export function saveCreditAssessment(assessment: CreditAssessmentItem): CreditAssessmentItem[] {
  if (typeof window === 'undefined') return [assessment];
  const list = getCreditAssessments();
  const existingIndex = list.findIndex(a => 
    a.id === assessment.id || 
    (assessment.applicationId && a.applicationId === assessment.applicationId)
  );
  
  const itemToSave: CreditAssessmentItem = { ...assessment, pendingSync: true };
  if (existingIndex >= 0) {
    list[existingIndex] = { ...list[existingIndex], ...itemToSave };
  } else {
    list.unshift(itemToSave);
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));

  // Sync to server so Incognito tabs and other windows receive it immediately
  try {
    fetch('/api/assessments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(assessment),
    })
      .then((res) => {
        if (!res.ok) return;
        const current = getCreditAssessments();
        const idx = current.findIndex(
          (a) => a.id === assessment.id || (assessment.applicationId && a.applicationId === assessment.applicationId)
        );
        if (idx >= 0 && current[idx].pendingSync) {
          current[idx] = { ...current[idx], pendingSync: false };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
        }
      })
      .catch(() => {});
  } catch (e) {}

  try {
    window.dispatchEvent(new Event('storage'));
  } catch (e) {}
  return list;
}

export function updateAssessmentStatus(
  idOrAppId: string,
  status: CreditAssessmentItem['status'],
  extra?: Partial<CreditAssessmentItem>
): CreditAssessmentItem[] {
  if (typeof window === 'undefined') return [];
  const list = getCreditAssessments();
  const index = list.findIndex(a => a.id === idOrAppId || a.applicationId === idOrAppId);
  if (index >= 0) {
    const updatedItem: CreditAssessmentItem = { ...list[index], status, ...extra, pendingSync: true };
    list[index] = updatedItem;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));

    // Sync to server
    try {
      fetch('/api/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedItem),
      })
        .then((res) => {
          if (!res.ok) return;
          const current = getCreditAssessments();
          const idx = current.findIndex(
            (a) => a.id === updatedItem.id || (updatedItem.applicationId && a.applicationId === updatedItem.applicationId)
          );
          if (idx >= 0 && current[idx].pendingSync) {
            current[idx] = { ...current[idx], pendingSync: false };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
          }
        })
        .catch(() => {});
    } catch (e) {}

    try {
      window.dispatchEvent(new Event('storage'));
    } catch (e) {}
  }
  return list;
}

/**
 * Reconciles localStorage assessments with an authoritative server response while
 * preserving offline-created/updated records (`pendingSync === true`).
 * Only call this when `GET /api/assessments` succeeds (`res.ok`).
 */
export function reconcileAssessmentsWithServer(
  localList: CreditAssessmentItem[],
  serverItems: CreditAssessmentItem[]
): CreditAssessmentItem[] {
  const reconciled: CreditAssessmentItem[] = [];
  const matchedLocalIndices = new Set<number>();

  for (const serverItem of serverItems) {
    const localIdx = localList.findIndex(
      (a) =>
        a.id === serverItem.id ||
        (serverItem.applicationId && a.applicationId === serverItem.applicationId) ||
        (serverItem.policyNo && serverItem.policyNo !== 'LCAP-' && a.policyNo === serverItem.policyNo)
    );

    if (localIdx >= 0) {
      matchedLocalIndices.add(localIdx);
      const local = localList[localIdx];
      reconciled.push({
        ...local,
        ...serverItem,
        status: resolveAssessmentSyncStatus(local.status, serverItem.status),
        adminDisbursementRelease: local.adminDisbursementRelease || serverItem.adminDisbursementRelease,
        aoDisbursementConfirmation: local.aoDisbursementConfirmation || serverItem.aoDisbursementConfirmation,
        pendingSync: false,
      });
    } else {
      reconciled.push({ ...serverItem, pendingSync: false });
    }
  }

  // Keep offline-only records that haven't been acknowledged by the server yet
  localList.forEach((localItem, idx) => {
    if (!matchedLocalIndices.has(idx) && localItem.pendingSync) {
      reconciled.push(localItem);
    }
  });

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reconciled));
    } catch {}
  }

  return reconciled;
}

