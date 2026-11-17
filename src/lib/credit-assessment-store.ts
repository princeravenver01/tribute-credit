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
  status: 'pending_assessment' | 'pending_admin' | 'admin_approved' | 'admin_rejected' | 'contract_ready' | 'disbursed';
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
  
  if (existingIndex >= 0) {
    list[existingIndex] = { ...list[existingIndex], ...assessment };
  } else {
    list.unshift(assessment);
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));

  // Sync to server so Incognito tabs and other windows receive it immediately
  try {
    fetch('/api/assessments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(assessment),
    }).catch(() => {});
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
    list[index] = { ...list[index], status, ...extra };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));

    // Sync to server
    try {
      fetch('/api/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(list[index]),
      }).catch(() => {});
    } catch (e) {}

    try {
      window.dispatchEvent(new Event('storage'));
    } catch (e) {}
  }
  return list;
}

