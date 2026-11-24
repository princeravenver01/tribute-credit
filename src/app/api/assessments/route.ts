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
  applicantSignatureAuthId?: string;
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

let loanApplicationSchemaEnsured = false;

async function ensureLoanApplicationSchema(executor: { execute: (sql: string) => Promise<unknown> }) {
  if (loanApplicationSchemaEnsured) return;
  const [cols] = (await executor.execute('SHOW COLUMNS FROM loan_applications')) as unknown as [
    Array<{ Field: string }>
  ];
  const existing = new Set(cols.map((c) => c.Field));
  if (!existing.has('workflow_status')) {
    await executor.execute(
      'ALTER TABLE loan_applications ADD COLUMN `workflow_status` VARCHAR(64) NULL AFTER `status`'
    );
  }
  if (!existing.has('payload_json')) {
    await executor.execute(
      'ALTER TABLE loan_applications ADD COLUMN `payload_json` LONGTEXT NULL AFTER `rejection_reason`'
    );
  }
  loanApplicationSchemaEnsured = true;
}

import bcrypt from 'bcryptjs';

// Helper: sync an assessment record to MySQL tribute_coop_db atomically
async function syncToMySql(item: AssessmentRecord, actor?: { userId: number; role: string }) {
  const loanCode = item.applicationId || item.id;
  if (!loanCode) return;

  const { isDatabaseConfigured, ensureCoopMemberSchema } = await import('@/lib/coop-member-store');
  if (!isDatabaseConfigured()) {
    return;
  }

  const db = await import('@/lib/db');
  const pool = db.getDbPool();
  const conn = await pool.getConnection();

  try {
    await ensureCoopMemberSchema(conn);
    await ensureLoanApplicationSchema(conn);
    await conn.beginTransaction();

    // 1. Resolve or create user/borrower in MySQL users table
    const borrowerEmail = (item.borrowerEmail || `${loanCode.toLowerCase().replace(/[^a-z0-9]/g, '')}@tribute.coop`).toLowerCase().trim();
    const borrowerName = item.borrowerName || 'Borrower Member';
    const contact = item.contactNumber || '';
    const address = item.location || '';

    // Deterministic identity lookup by email ONLY (never name-only)
    const [existingUsers] = (await conn.execute(
      'SELECT id FROM users WHERE email = ? LIMIT 1 FOR UPDATE',
      [borrowerEmail]
    )) as unknown as [Record<string, unknown>[]];

    let borrowerId: number;
    if (existingUsers && existingUsers.length > 0) {
      borrowerId = existingUsers[0].id as number;
    } else {
      // Create valid strong temporary password hash via bcrypt
      const tempPasswordHash = await bcrypt.hash(`TributeTemp#${Date.now().toString(36)}`, 10);
      const rawPolicyNo = item.policyNo?.trim();
      let userMemberNo: string | null =
        rawPolicyNo && rawPolicyNo !== 'LCAP-' ? rawPolicyNo : null;
      if (userMemberNo) {
        const [dupMember] = (await conn.execute(
          'SELECT id FROM users WHERE member_no = ? LIMIT 1',
          [userMemberNo]
        )) as unknown as [Record<string, unknown>[]];
        if (dupMember && dupMember.length > 0) {
          userMemberNo = null;
        }
      }
      const [insertUserRes] = (await conn.execute(
        'INSERT INTO users (member_no, name, email, password, role, contact_number, address, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [userMemberNo, borrowerName, borrowerEmail, tempPasswordHash, 'borrower', contact, address, 'active']
      )) as unknown as [{ insertId: number }];
      borrowerId = insertUserRes.insertId;
    }

    // 2. Strict Every-Borrower Cooperative Membership Resolution / Creation
    const authoritativeMemberNo = (item.mcid || item.fullProfile?.step1?.cooperativeId || item.cidNumber)?.trim();
    const step1 = item.fullProfile?.step1 || {};
    const step2 = item.fullProfile?.step2 || {};
    const govIds = item.fullProfile?.govIds || [];
    const primaryGovId = Array.isArray(govIds) && govIds.length > 0 ? govIds[0] : null;

    // Check if coop_members row exists
    let matchedMemberNo: string | null = null;
    let matchedLinkedUserId: number | null = null;

    if (authoritativeMemberNo) {
      const [byNo] = (await conn.execute(
        'SELECT member_no, linked_user_id FROM coop_members WHERE member_no = ? LIMIT 1 FOR UPDATE',
        [authoritativeMemberNo]
      )) as unknown as [Record<string, unknown>[]];
      if (byNo && byNo.length > 0) {
        matchedMemberNo = byNo[0].member_no as string;
        matchedLinkedUserId = (byNo[0].linked_user_id as number) || null;
      }
    }

    if (!matchedMemberNo && borrowerEmail) {
      const [byEmail] = (await conn.execute(
        'SELECT member_no, linked_user_id FROM coop_members WHERE email = ? LIMIT 1 FOR UPDATE',
        [borrowerEmail]
      )) as unknown as [Record<string, unknown>[]];
      if (byEmail && byEmail.length > 0) {
        matchedMemberNo = byEmail[0].member_no as string;
        matchedLinkedUserId = (byEmail[0].linked_user_id as number) || null;
      }
    }

    if (matchedMemberNo) {
      if (matchedLinkedUserId && matchedLinkedUserId !== borrowerId) {
        throw new Error(
          `Cooperative member ${matchedMemberNo} is already linked to another user account (User ID: ${matchedLinkedUserId}). Cannot link to User ID ${borrowerId}.`
        );
      }
      if (!matchedLinkedUserId) {
        await conn.execute(
          'UPDATE coop_members SET linked_user_id = ? WHERE member_no = ?',
          [borrowerId, matchedMemberNo]
        );
      }
    } else {
      // Insert provisional borrower-only cooperative member using authoritative profile fields
      const { generateMemberNo } = await import('@/lib/coop-member-store');
      const memberNo = generateMemberNo();
      const parts = borrowerName.trim().split(/\s+/);
      const firstName = step1.firstName?.trim() || parts[0] || 'Borrower';
      const middleName = step1.middleName?.trim() || (parts.length > 2 ? parts.slice(1, -1).join(' ') : null);
      const lastName = step1.lastName?.trim() || (parts.length > 1 ? parts[parts.length - 1] : 'Member');
      const suffix = step1.suffix?.trim() || null;
      const fullName = borrowerName.trim() || [firstName, middleName, lastName, suffix].filter(Boolean).join(' ');
      const gender = step1.sex === 'Female' ? 'Female' : step1.sex === 'Male' ? 'Male' : null;
      const dateOfBirth = step1.dateOfBirth?.trim() || null;
      const civilStatus = step1.civilStatus || null;
      const contactNumber = contact || step2.mobileNumber || '';
      const fullAddress = address || step2.addressLine1 || '';
      const barangay = step2.barangay || '';
      const city = step2.city || '';
      const province = step2.province || '';
      const occupation = item.livelihood || item.fullProfile?.step4?.occupation || '';
      const monthlyIncome = Number(item.monthlyNetIncome || item.fullProfile?.step4?.monthlyNetIncome) || 0;
      const validIdType = primaryGovId?.idType || null;
      const validIdNumber = primaryGovId?.idNumber || null;
      const signatureData = item.applicantSignature || null;
      // Real signature auth id from profile or null (NEVER fabricated)
      const signatureAuthId = item.fullProfile?.step1?.signatureAuthId || item.applicantSignatureAuthId || null;
      const photoUrl = item.applicantFacePhoto || null;
      const idSelfieUrl = item.borrowerHoldingIdPhoto || null;
      const nowIso = new Date().toISOString();

      await conn.execute(
        `INSERT INTO coop_members
         (member_no, linked_user_id, membership_type, first_name, middle_name, last_name, suffix, full_name, gender, date_of_birth, civil_status,
          email, contact_number, address, barangay, city, province, occupation, monthly_income,
          signature_data, signature_auth_id, signature_timestamp, photo_url, photo_timestamp,
          id_selfie_url, id_selfie_timestamp, valid_id_type, valid_id_number,
          registration_fee, capital_share, initial_savings, total_paid, payment_method, payment_reference,
          registered_by_id, registered_by_name, registered_by_role, registration_status)
         VALUES (?, ?, 'borrower_only', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.00, 0.00, 0.00, 0.00, 'cash', 'PENDING-ONBOARDING', NULL, ?, 'account_officer', 'active')`,
        [
          memberNo,
          borrowerId,
          firstName,
          middleName,
          lastName,
          suffix,
          fullName,
          gender,
          dateOfBirth,
          civilStatus,
          borrowerEmail,
          contactNumber,
          fullAddress,
          barangay,
          city,
          province,
          occupation,
          monthlyIncome,
          signatureData,
          signatureAuthId,
          signatureData ? new Date(nowIso) : null,
          photoUrl,
          photoUrl ? new Date(nowIso) : null,
          idSelfieUrl,
          idSelfieUrl ? new Date(nowIso) : null,
          validIdType,
          validIdNumber,
          item.evaluatedByOfficer || 'Account Officer',
        ]
      );
    }

    // 3. Map application status and write loan_applications row
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

    const [existingLoans] = (await conn.execute(
      'SELECT id, assigned_officer_id, approved_by_admin_id FROM loan_applications WHERE loan_code = ? LIMIT 1 FOR UPDATE',
      [loanCode]
    )) as unknown as [Record<string, unknown>[]];

    // Resolve valid foreign keys dynamically instead of hardcoding user/product IDs
    let resolvedOfficerId: number | null =
      (existingLoans?.[0]?.assigned_officer_id as number | null | undefined) ?? null;
    if (!resolvedOfficerId) {
      if (actor?.role === 'account_officer') {
        resolvedOfficerId = actor.userId;
      } else {
        const [officers] = (await conn.execute(
          "SELECT id FROM users WHERE role = 'account_officer' ORDER BY id ASC LIMIT 1"
        )) as unknown as [Record<string, unknown>[]];
        resolvedOfficerId = officers?.[0]?.id ? Number(officers[0].id) : null;
      }
    }

    let resolvedAdminId: number | null =
      (existingLoans?.[0]?.approved_by_admin_id as number | null | undefined) ?? null;
    if ((dbStatus === 'approved' || dbStatus === 'disbursed') && !resolvedAdminId) {
      if (actor?.role === 'admin') {
        resolvedAdminId = actor.userId;
      } else {
        const [admins] = (await conn.execute(
          "SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1"
        )) as unknown as [Record<string, unknown>[]];
        resolvedAdminId = admins?.[0]?.id ? Number(admins[0].id) : null;
      }
    }

    const serializedPayload = JSON.stringify(item);

    if (existingLoans && existingLoans.length > 0) {
      await conn.execute(
        `UPDATE loan_applications SET 
          amount_requested = ?,
          status = ?,
          workflow_status = ?,
          assigned_officer_id = COALESCE(assigned_officer_id, ?),
          officer_notes = ?,
          rejection_reason = ?,
          payload_json = ?,
          approved_by_admin_id = ?,
          disbursed_at = ?
         WHERE loan_code = ?`,
        [
          finalAmount,
          dbStatus,
          item.status || null,
          resolvedOfficerId,
          officerNotes,
          rejectionReason,
          serializedPayload,
          (dbStatus === 'approved' || dbStatus === 'disbursed') ? resolvedAdminId : null,
          dbStatus === 'disbursed' ? new Date() : null,
          loanCode
        ]
      );
    } else {
      let resolvedProductId: number | null = null;
      if (item.productName) {
        const [matchedProducts] = (await conn.execute(
          'SELECT id FROM loan_products WHERE name = ? LIMIT 1',
          [item.productName]
        )) as unknown as [Record<string, unknown>[]];
        if (matchedProducts?.[0]?.id) resolvedProductId = Number(matchedProducts[0].id);
      }
      if (!resolvedProductId) {
        const [anyProducts] = (await conn.execute(
          'SELECT id FROM loan_products ORDER BY id ASC LIMIT 1'
        )) as unknown as [Record<string, unknown>[]];
        if (anyProducts?.[0]?.id) resolvedProductId = Number(anyProducts[0].id);
      }
      if (!resolvedProductId) {
        const [insertedProduct] = (await conn.execute(
          "INSERT INTO loan_products (name, description, interest_rate, term_months, min_amount, max_amount) VALUES ('Regular Emergency Loan', 'Default cooperative loan product', 1.50, 12, 2000.00, 50000.00)"
        )) as unknown as [{ insertId: number }];
        resolvedProductId = insertedProduct.insertId;
      }

      await conn.execute(
        `INSERT INTO loan_applications 
          (loan_code, borrower_id, product_id, amount_requested, term_months, interest_rate, purpose, monthly_amortization, status, workflow_status, assigned_officer_id, officer_notes, approved_by_admin_id, rejection_reason, payload_json) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          loanCode,
          borrowerId,
          resolvedProductId,
          finalAmount,
          termMonths,
          3.00,
          purpose,
          monthlyAmort,
          dbStatus,
          item.status || null,
          resolvedOfficerId,
          officerNotes,
          (dbStatus === 'approved' || dbStatus === 'disbursed') ? resolvedAdminId : null,
          rejectionReason,
          serializedPayload
        ]
      );
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    console.error('Atomic MySQL sync error in /api/assessments:', err);
    throw err;
  } finally {
    conn.release();
  }
}

export async function GET() {
  const auth = await requireApiRole('account_officer', 'admin', 'disbursement');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const db = await import('@/lib/db');
    await ensureLoanApplicationSchema(db.getDbPool());

    const rows: any = await query(`
      SELECT 
        la.id as db_id,
        la.loan_code,
        la.amount_requested,
        la.term_months,
        la.status,
        la.workflow_status,
        la.purpose,
        la.officer_notes,
        la.rejection_reason,
        la.payload_json,
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

    const dbLoanCodes = new Set<string>(
      Array.isArray(rows) ? rows.map((r: { loan_code: string }) => r.loan_code) : []
    );
    global.__tributeAssessmentsStore = (global.__tributeAssessmentsStore || []).filter(
      (item) => dbLoanCodes.has(item.applicationId || item.id)
    );

    if (rows && rows.length > 0) {
      for (const row of rows) {
        const mappedStatus = row.workflow_status || (
          row.status === 'approved'
            ? 'admin_approved'
            : row.status === 'rejected'
            ? 'admin_rejected'
            : row.status === 'disbursed'
            ? 'disbursed'
            : row.status === 'under_review'
            ? 'pending_admin'
            : row.status === 'pending'
            ? 'pending_assessment'
            : 'pending_assessment'
        );

        let parsedPayload: Partial<AssessmentRecord> | null = null;
        if (typeof row.payload_json === 'string' && row.payload_json.trim()) {
          try {
            parsedPayload = JSON.parse(row.payload_json) as Partial<AssessmentRecord>;
          } catch {
            parsedPayload = null;
          }
        }

        const fallbackRecord: AssessmentRecord = {
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

        const record: AssessmentRecord = parsedPayload
          ? {
              ...fallbackRecord,
              ...parsedPayload,
              status: parsedPayload.status || mappedStatus,
            }
          : fallbackRecord;

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
      // Only upsert into memory AFTER syncToMySql transaction succeeds
      for (const item of body.items) {
        await syncToMySql(item, auth.session);
        upsertRecord(item);
      }
      return NextResponse.json({
        success: true,
        data: global.__tributeAssessmentsStore,
      });
    }

    // Default single record upsert: sync first, then upsert in memory
    if (body.id || body.applicationId) {
      await syncToMySql(body, auth.session);
      upsertRecord(body);
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

