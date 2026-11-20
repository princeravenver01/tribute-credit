import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireApiRole } from '@/lib/server-auth';

// Server-side assessment & loan record interface
interface AssessmentRecord {
  id: string;
  applicationId: string;
  borrowerName: string;
  policyNo: string;
  contactNumber: string;
  location: string;
  livelihood: string;
  yearsInBusiness: number;
  monthlyNetIncome: number;
  existingDebts: number;
  netDisposableIncome: number;
  requestedAmount: number;
  productName: string;
  termMonths: number;
  paymentMode: string;
  aiPreApprovedAmount: number;
  aiRiskRating: string;
  aiDsr: number;
  aiConfidenceScore: number;
  aiRecommendationNote: string;
  fiveCs: any;
  officerAdjustedAmount: number;
  officerRecommendation: string;
  officerNotes: string;
  evaluatedByOfficer: string;
  evaluatedAt: string;
  status: string;
  adminApprovedAmount?: number;
  previousAdminApprovedAmount?: number;
  reconsiderationJustification?: string;
  adminNotes?: string;
  adminActionAt?: string;
  adjustmentCount?: number;
  maxAdjustmentsReached?: boolean;
  finalContractAmount?: number;
  applicantSignature?: string;
  applicantFacePhoto?: string;
  borrowerHoldingIdPhoto?: string;
  borrowerSignatures?: any[];
  officerSignatures?: any[];
  fullProfile?: any;
  mcid?: string;
  borrowerEmail?: string;
  tempPassword?: string;
  disbursementMode?: string;
  disbursementChannel?: string;
  disbursementAccountNumber?: string;
  spouseName?: string;
  membershipDate?: string;
  cidNumber?: string;
  loanCycle?: number;
  branchManagerName?: string;
  adminDisbursementRelease?: any;
  aoDisbursementConfirmation?: any;
  disbursedAt?: string;
  disbursedBy?: string;
  disbursementReferenceNo?: string;
  disbursementNotes?: string;
  firstDueDate?: string;
  nextDueDate?: string;
  totalCollected?: number;
  remainingBalance?: number;
}

// Global server cache variable (persists across requests in node process)
declare global {
  var __tributeAssessmentsStore: AssessmentRecord[] | undefined;
}

if (!global.__tributeAssessmentsStore) {
  global.__tributeAssessmentsStore = [];
}

// Helper: sync an assessment record to MySQL tribute_coop_db
async function syncToMySql(item: AssessmentRecord) {
  try {
    const loanCode = item.applicationId || item.id;
    if (!loanCode) return;

    // 1. Resolve or create user/borrower in MySQL users table
  const borrowerEmail = item.borrowerEmail || `${loanCode.toLowerCase().replace(/[^a-z0-9]/g, '')}@tribute.coop`;
  const borrowerName = item.borrowerName || 'Borrower Member';
  const contact = item.contactNumber || '';
  const address = item.location || '';

  // Check if user exists
  const existingUsers: any = await query(
    'SELECT id FROM users WHERE email = ? OR name = ? LIMIT 1',
    [borrowerEmail, borrowerName]
  );

  let borrowerId: number;
  if (existingUsers && existingUsers.length > 0) {
    borrowerId = existingUsers[0].id;
  } else {
    const insertUserRes: any = await query(
      'INSERT INTO users (member_no, name, email, password, role, contact_number, address, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [item.policyNo || `MEM-${Date.now().toString().slice(-6)}`, borrowerName, borrowerEmail, '$2b$10$tributeTempHashPlaceholder', 'borrower', contact, address, 'active']
    );
    borrowerId = insertUserRes.insertId;
  }

  // 2. Strict Every-Borrower Cooperative Membership Resolution / Creation
  // Correct member identifier lookup: prefer mcid or fullProfile.step1.cooperativeId, NOT policyNo
  const authoritativeMemberNo = (item.mcid || item.fullProfile?.step1?.cooperativeId || item.cidNumber)?.trim();
  const step1 = item.fullProfile?.step1 || {};
  const step2 = item.fullProfile?.step2 || {};
  const govIds = item.fullProfile?.govIds || [];
  const primaryGovId = Array.isArray(govIds) && govIds.length > 0 ? govIds[0] : null;

  const { createProvisionalBorrowerMember, linkMemberToUserAccount, findMatchingCooperativeMember } = await import('@/lib/coop-member-store');

  const matched = await findMatchingCooperativeMember({
    memberNo: authoritativeMemberNo,
    email: borrowerEmail,
    contactNumber: contact,
    dateOfBirth: step1.dateOfBirth,
  });

  if (matched) {
    // If the matched member is already linked to a different user, raise conflict!
    if (matched.linkedUserId && matched.linkedUserId !== borrowerId) {
      throw new Error(
        `Cooperative member ${matched.memberNo} is already linked to another user account (User ID: ${matched.linkedUserId}). Cannot link to User ID ${borrowerId}.`
      );
    }
    if (!matched.linkedUserId) {
      await linkMemberToUserAccount(matched.memberNo, borrowerId);
    }
  } else {
    // Create provisional borrower-only membership with authoritative profile fields (NO fabricated dummy data)
    await createProvisionalBorrowerMember({
      linkedUserId: borrowerId,
      name: borrowerName,
      email: borrowerEmail,
      contactNumber: contact || step2.mobileNumber || '',
      address: address || step2.addressLine1 || '',
      firstName: step1.firstName,
      middleName: step1.middleName,
      lastName: step1.lastName,
      suffix: step1.suffix,
      gender: step1.sex === 'Female' ? 'Female' : step1.sex === 'Male' ? 'Male' : null,
      dateOfBirth: step1.dateOfBirth || null,
      civilStatus: step1.civilStatus || null,
      barangay: step2.barangay || '',
      city: step2.city || '',
      province: step2.province || '',
      occupation: item.livelihood || item.fullProfile?.step4?.occupation || '',
      monthlyIncome: Number(item.monthlyNetIncome || item.fullProfile?.step4?.monthlyNetIncome) || 0,
      validIdType: primaryGovId?.idType || null,
      validIdNumber: primaryGovId?.idNumber || null,
      applicantSignature: item.applicantSignature || null,
      applicantPhoto: item.applicantFacePhoto || null,
      holdingIdPhoto: item.borrowerHoldingIdPhoto || null,
      recordedByName: item.evaluatedByOfficer || 'Account Officer',
      recordedByRole: 'account_officer',
    });
  }

    // 2. Map application status to DB enum ('pending', 'under_review', 'approved', 'rejected', 'disbursed', 'completed')
    // Note: pending_ao_disbursement is NOT yet disbursed in MySQL — it maps to 'approved' with disbursed_at = null.
    let dbStatus: 'pending' | 'under_review' | 'approved' | 'rejected' | 'disbursed' = 'pending';
    if (
      item.status === 'admin_approved' ||
      item.status === 'contract_ready' ||
      item.status === 'pending_ao_disbursement'
    ) {
      dbStatus = 'approved';
    } else if (item.status === 'admin_rejected') {
      dbStatus = 'rejected';
    } else if (item.status === 'disbursed') {
      dbStatus = 'disbursed';
    } else if (item.status === 'pending_admin') {
      dbStatus = 'under_review';
    }

    const finalAmount = Number(
      (item.status === 'admin_approved' ||
        item.status === 'contract_ready' ||
        item.status === 'pending_ao_disbursement' ||
        item.status === 'disbursed') &&
        item.adminApprovedAmount
        ? item.adminApprovedAmount
        : item.officerAdjustedAmount || item.requestedAmount || 10000
    );
    const termMonths = Number(item.termMonths || 3);
    const monthlyAmort = Math.round((finalAmount * 1.05) / (termMonths || 3));
    const purpose = item.livelihood || item.officerNotes || 'Cooperative Microfinance Loan';
    const officerNotes = item.officerNotes || item.aiRecommendationNote || '';
    const rejectionReason = item.status === 'admin_rejected' ? (item.adminNotes || 'Declined during Credit Committee review') : null;

    // Check if loan_application row exists
    const existingLoan: any = await query(
      'SELECT id FROM loan_applications WHERE loan_code = ? LIMIT 1',
      [loanCode]
    );

    if (existingLoan && existingLoan.length > 0) {
      await query(
        `UPDATE loan_applications SET 
          amount_requested = ?,
          status = ?,
          officer_notes = ?,
          rejection_reason = ?,
          approved_by_admin_id = ?,
          disbursed_at = ?
         WHERE loan_code = ?`,
        [
          finalAmount,
          dbStatus,
          officerNotes,
          rejectionReason,
          (dbStatus === 'approved' || dbStatus === 'disbursed') ? 1 : null,
          dbStatus === 'disbursed' ? new Date() : null,
          loanCode
        ]
      );
    } else {
      await query(
        `INSERT INTO loan_applications 
          (loan_code, borrower_id, product_id, amount_requested, term_months, interest_rate, purpose, monthly_amortization, status, assigned_officer_id, officer_notes, approved_by_admin_id, rejection_reason) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          loanCode,
          borrowerId,
          1, // default product
          finalAmount,
          termMonths,
          3.00,
          purpose,
          monthlyAmort,
          dbStatus,
          2, // Officer Juan
          officerNotes,
          (dbStatus === 'approved' || dbStatus === 'disbursed') ? 1 : null,
          rejectionReason
        ]
      );
    }
  } catch (err) {
    console.error('MySQL sync error in /api/assessments:', err);
    throw err;
  }
}

export async function GET() {
  const auth = await requireApiRole('account_officer', 'admin', 'disbursement');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const rows: any = await query(`
      SELECT 
        la.id as db_id,
        la.loan_code,
        la.amount_requested,
        la.term_months,
        la.status,
        la.purpose,
        la.officer_notes,
        la.rejection_reason,
        la.created_at,
        u.name as borrower_name,
        u.member_no,
        u.contact_number,
        u.address,
        u.email as borrower_email
      FROM loan_applications la
      LEFT JOIN users u ON la.borrower_id = u.id
      ORDER BY la.created_at DESC
    `);

    if (rows && rows.length > 0) {
      if (!global.__tributeAssessmentsStore) global.__tributeAssessmentsStore = [];
      for (const row of rows) {
        const mappedStatus = row.status === 'approved' 
          ? 'admin_approved' 
          : row.status === 'rejected' 
          ? 'admin_rejected' 
          : row.status === 'disbursed'
          ? 'disbursed'
          : row.status === 'under_review'
          ? 'pending_admin'
          : row.status === 'pending'
          ? 'pending_assessment'
          : 'pending_assessment';

        const record: AssessmentRecord = {
          id: `CA-${row.loan_code.replace(/[^0-9]/g, '') || row.db_id}`,
          applicationId: row.loan_code,
          borrowerName: row.borrower_name || 'Member Borrower',
          policyNo: row.member_no || 'LCAP-',
          contactNumber: row.contact_number || '+63 917 000 0000',
          location: row.address || 'Metro Manila',
          livelihood: row.purpose || 'Micro-Enterprise',
          yearsInBusiness: 3,
          monthlyNetIncome: 25000,
          existingDebts: 0,
          netDisposableIncome: 20000,
          requestedAmount: Number(row.amount_requested) || 10000,
          productName: 'Regular Loan (3 mos)',
          termMonths: Number(row.term_months) || 3,
          paymentMode: 'Daily',
          aiPreApprovedAmount: Number(row.amount_requested) || 10000,
          aiRiskRating: 'Class A (Prime / Low Risk)',
          aiDsr: 25,
          aiConfidenceScore: 94.2,
          aiRecommendationNote: 'Registered in Tribute Coop Database.',
          fiveCs: {
            characterScore: 18,
            characterNotes: 'Verified in cooperative system records.',
            capacityScore: 21,
            capacityNotes: 'Repayment capacity supported by declared income.',
            capitalScore: 16,
            capitalNotes: 'Cooperative member equity verified.',
            collateralScore: 14,
            collateralNotes: 'Personal co-maker undertaking verified.',
            conditionsScore: 13,
            conditionsNotes: 'Prime microfinance operating condition.',
            totalScore: 82,
            riskGrade: 'Class A (Prime / Low Risk)',
          },
          officerAdjustedAmount: Number(row.amount_requested) || 10000,
          officerRecommendation: 'recommend_approve',
          officerNotes: row.officer_notes || 'Endorsed for Committee approval.',
          evaluatedByOfficer: 'Officer Juan (AO-001)',
          evaluatedAt: new Date(row.created_at).toISOString().replace('T', ' ').substring(0, 16),
          status: mappedStatus,
          adminApprovedAmount: Number(row.amount_requested) || 10000,
          adminNotes: row.rejection_reason || undefined,
          borrowerEmail: row.borrower_email
        };

        upsertRecord(record, true);
      }
    }
  } catch (err) {
    console.error('Failed to load from MySQL in GET /api/assessments:', err);
  }

  return NextResponse.json({
    success: true,
    data: global.__tributeAssessmentsStore || [],
    count: (global.__tributeAssessmentsStore || []).length,
  });
}

export async function POST(req: Request) {
  const auth = await requireApiRole('account_officer', 'admin', 'disbursement');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await req.json();

    if (body.action === 'clear_all') {
      global.__tributeAssessmentsStore = [];
      try {
        await query('DELETE FROM repayment_schedules');
        await query('DELETE FROM loan_applications');
      } catch (err) {
        console.error('MySQL clear_all error:', err);
      }
      return NextResponse.json({ success: true, message: 'All assessments cleared from server store and MySQL' });
    }

    if (body.action === 'save_batch' && Array.isArray(body.items)) {
      if (!global.__tributeAssessmentsStore) global.__tributeAssessmentsStore = [];
      for (const item of body.items) {
        upsertRecord(item);
        await syncToMySql(item);
      }
      return NextResponse.json({
        success: true,
        data: global.__tributeAssessmentsStore,
      });
    }

    // Default single record upsert
    if (body.id || body.applicationId) {
      upsertRecord(body);
      await syncToMySql(body);
      return NextResponse.json({
        success: true,
        data: global.__tributeAssessmentsStore,
      });
    }

    return NextResponse.json({ error: 'Invalid assessment data payload' }, { status: 400 });
  } catch (error: any) {
    console.error('Error in /api/assessments:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

function upsertRecord(item: AssessmentRecord, fromDbSync = false) {
  if (!global.__tributeAssessmentsStore) global.__tributeAssessmentsStore = [];
  const list = global.__tributeAssessmentsStore;

  const idx = list.findIndex(
    a =>
      a.id === item.id ||
      (item.applicationId && a.applicationId === item.applicationId)
  );

  if (idx >= 0) {
    const existing = list[idx];
    let mergedStatus = item.status || existing.status;
    // DB 'approved' maps to admin_approved, contract_ready, or pending_ao_disbursement in app memory.
    // Never downgrade a more specific in-memory stage back to admin_approved during DB hydration.
    if (
      fromDbSync &&
      item.status === 'admin_approved' &&
      (existing.status === 'contract_ready' ||
        existing.status === 'pending_ao_disbursement' ||
        existing.status === 'disbursed')
    ) {
      mergedStatus = existing.status;
    }

    list[idx] = {
      ...existing,
      ...item,
      status: mergedStatus,
      // Keep Stage 1 Admin release evidence immutable once captured
      adminDisbursementRelease: existing.adminDisbursementRelease || item.adminDisbursementRelease,
      aoDisbursementConfirmation: existing.aoDisbursementConfirmation || item.aoDisbursementConfirmation,
    };
  } else {
    list.unshift(item);
  }
}

