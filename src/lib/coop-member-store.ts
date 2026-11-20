import type { PoolConnection } from 'mysql2/promise';

export const MEMBER_FEES = {
  REGISTRATION_FEE: 500,
  CAPITAL_SHARE: 2000,
  INITIAL_SAVINGS: 500,
  TOTAL_PAYMENT: 3000,
} as const;

export const ALLOWED_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const MAX_DECODED_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB max

export function validateEvidenceDataUrl(dataUrl: string, fieldName: string): void {
  if (!dataUrl || typeof dataUrl !== 'string') {
    throw new Error(`${fieldName} is strictly required.`);
  }

  const match = dataUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
  if (!match) {
    throw new Error(`${fieldName} must be a valid base64 image data URL.`);
  }

  const mimeType = match[1].toLowerCase();
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(mimeType)) {
    throw new Error(
      `${fieldName} has unsupported MIME type "${mimeType}". Allowed types: PNG, JPEG, WEBP.`
    );
  }

  const base64Data = match[2];
  // Approximate decoded byte size: (base64 string length * 3) / 4 minus padding
  const padding = (base64Data.endsWith('==') ? 2 : base64Data.endsWith('=') ? 1 : 0);
  const approximateBytes = Math.floor((base64Data.length * 3) / 4) - padding;

  if (approximateBytes > MAX_DECODED_IMAGE_BYTES) {
    throw new Error(
      `${fieldName} exceeds the maximum allowed file size of 5 MB (decoded size: ${(approximateBytes / (1024 * 1024)).toFixed(2)} MB).`
    );
  }
}

export class DuplicateMemberError extends Error {
  code = 'DUPLICATE_MEMBER';
  statusCode = 409;
  constructor(message: string) {
    super(message);
    this.name = 'DuplicateMemberError';
  }
}

export class DatabasePersistenceError extends Error {
  code = 'DATABASE_ERROR';
  statusCode = 500;
  constructor(message: string) {
    super(message);
    this.name = 'DatabasePersistenceError';
  }
}

export interface CooperativeMember {
  id: number | string;
  memberNo: string; // e.g. TCID-M-2026-0001
  linkedUserId?: number | null; // Nullable link to users table for future borrower/applicant conversion
  firstName: string;
  middleName?: string;
  lastName: string;
  suffix?: string;
  fullName: string;
  gender: 'Male' | 'Female' | 'Other';
  dateOfBirth: string;
  civilStatus: 'Single' | 'Married' | 'Widowed' | 'Separated' | 'Divorced';
  email: string;
  contactNumber: string;
  address: string;
  barangay: string;
  city: string;
  province: string;
  occupation: string;
  monthlyIncome: number;

  // 3 Mandatory Identity & Evidence items
  signatureData: string;
  signatureAuthId: string;
  signatureTimestamp: string;
  photoUrl: string;
  photoTimestamp: string;
  idSelfieUrl: string;
  idSelfieTimestamp: string;
  validIdType: string;
  validIdNumber: string;

  // Fees Breakdown
  registrationFee: number;
  capitalShare: number;
  initialSavings: number;
  totalPaid: number;
  paymentMethod: 'cash' | 'online' | 'bank_transfer';
  paymentReference?: string;

  // Audit Info
  registeredById?: number;
  registeredByName: string;
  registeredByRole: 'admin' | 'account_officer';
  registrationStatus: 'active' | 'inactive' | 'suspended';
  createdAt: string;
  updatedAt: string;
}

export interface RegisterMemberInput {
  firstName: string;
  middleName?: string;
  lastName: string;
  suffix?: string;
  gender: 'Male' | 'Female' | 'Other';
  dateOfBirth: string;
  civilStatus: 'Single' | 'Married' | 'Widowed' | 'Separated' | 'Divorced';
  email: string;
  contactNumber: string;
  address: string;
  barangay: string;
  city: string;
  province: string;
  occupation: string;
  monthlyIncome: number;

  // 3 Mandatory Identity Evidence items
  signatureData: string;
  photoUrl: string;
  idSelfieUrl: string;
  validIdType: string;
  validIdNumber: string;

  paymentMethod: 'cash' | 'online' | 'bank_transfer';
  paymentReference?: string;

  registeredById?: number;
  registeredByName?: string;
  registeredByRole?: 'admin' | 'account_officer';
}

export interface MemberTransactionRecord {
  id?: number;
  memberId: number | string;
  memberNo: string;
  transactionType: 'registration_fee' | 'capital_share' | 'savings_deposit';
  amount: number;
  referenceNo: string;
  recordedByName: string;
  createdAt: string;
}

// In-Memory store fallback for environments without configured DB (e.g. unit test runner)
declare global {
  var __tributeCoopMembersStore: CooperativeMember[] | undefined;
  var __tributeCoopMemberTransactions: MemberTransactionRecord[] | undefined;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DB_HOST || process.env.DB_USER || process.env.DB_NAME);
}

// Collision-safe member number generation
export function generateMemberNo(): string {
  const year = new Date().getFullYear();
  const timeHex = Date.now().toString(36).toUpperCase();
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `TCID-M-${year}-${timeHex}-${randomPart}`;
}

export async function listCooperativeMembers(searchQuery = ''): Promise<CooperativeMember[]> {
  if (isDatabaseConfigured()) {
    try {
      const db = await import('./db');
      const rows = await db.query<Record<string, unknown>[]>(
        'SELECT * FROM coop_members ORDER BY id DESC'
      );
      if (rows && rows.length > 0) {
        let result = rows.map((r) => ({
          id: r.id as number | string,
          memberNo: r.member_no as string,
          linkedUserId: (r.linked_user_id as number) || null,
          firstName: r.first_name as string,
          middleName: (r.middle_name as string) || undefined,
          lastName: r.last_name as string,
          suffix: (r.suffix as string) || undefined,
          fullName: r.full_name as string,
          gender: r.gender as 'Male' | 'Female' | 'Other',
          dateOfBirth: r.date_of_birth as string,
          civilStatus: r.civil_status as 'Single' | 'Married' | 'Widowed' | 'Separated' | 'Divorced',
          email: r.email as string,
          contactNumber: r.contact_number as string,
          address: r.address as string,
          barangay: r.barangay as string,
          city: r.city as string,
          province: r.province as string,
          occupation: r.occupation as string,
          monthlyIncome: Number(r.monthly_income),
          signatureData: r.signature_data as string,
          signatureAuthId: r.signature_auth_id as string,
          signatureTimestamp: r.signature_timestamp as string,
          photoUrl: r.photo_url as string,
          photoTimestamp: r.photo_timestamp as string,
          idSelfieUrl: r.id_selfie_url as string,
          idSelfieTimestamp: r.id_selfie_timestamp as string,
          validIdType: r.valid_id_type as string,
          validIdNumber: r.valid_id_number as string,
          registrationFee: Number(r.registration_fee),
          capitalShare: Number(r.capital_share),
          initialSavings: Number(r.initial_savings),
          totalPaid: Number(r.total_paid),
          paymentMethod: r.payment_method as 'cash' | 'online' | 'bank_transfer',
          paymentReference: (r.payment_reference as string) || undefined,
          registeredById: (r.registered_by_id as number) || undefined,
          registeredByName: r.registered_by_name as string,
          registeredByRole: r.registered_by_role as 'admin' | 'account_officer',
          registrationStatus: (r.registration_status as 'active' | 'inactive' | 'suspended') || 'active',
          createdAt: r.created_at as string,
          updatedAt: r.updated_at as string,
        }));

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          result = result.filter(
            (m) =>
              m.fullName.toLowerCase().includes(q) ||
              m.memberNo.toLowerCase().includes(q) ||
              m.email.toLowerCase().includes(q) ||
              m.city.toLowerCase().includes(q) ||
              m.contactNumber.includes(q)
          );
        }

        return result;
      }
      return [];
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new DatabasePersistenceError(`Failed to fetch cooperative members from database: ${msg}`);
    }
  }

  // Memory fallback for unconfigured environments
  let memoryList = globalThis.__tributeCoopMembersStore || [];
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    memoryList = memoryList.filter(
      (m) =>
        m.fullName.toLowerCase().includes(q) ||
        m.memberNo.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.city.toLowerCase().includes(q) ||
        m.contactNumber.includes(q)
    );
  }
  return [...memoryList].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function linkMemberToUserAccount(
  memberNo: string,
  userId: number
): Promise<{ success: boolean; member: CooperativeMember }> {
  if (!memberNo || !userId) {
    throw new Error('Both memberNo and userId are required to link an account.');
  }

  if (isDatabaseConfigured()) {
    const db = await import('./db');
    const pool = db.getDbPool();
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      // Check if user already linked
      const [existingUserLink] = (await conn.execute(
        'SELECT id, member_no FROM coop_members WHERE linked_user_id = ? LIMIT 1',
        [userId]
      )) as unknown as [Record<string, unknown>[]];

      if (existingUserLink && existingUserLink.length > 0) {
        throw new DuplicateMemberError(
          `User ID ${userId} is already linked to cooperative member ${existingUserLink[0].member_no}`
        );
      }

      // Check target member
      const [members] = (await conn.execute(
        'SELECT * FROM coop_members WHERE member_no = ? LIMIT 1 FOR UPDATE',
        [memberNo]
      )) as unknown as [Record<string, unknown>[]];

      if (!members || members.length === 0) {
        throw new Error(`Cooperative member "${memberNo}" not found.`);
      }

      const m = members[0];
      if (m.linked_user_id) {
        throw new DuplicateMemberError(
          `Member ${memberNo} is already linked to user ID ${m.linked_user_id}`
        );
      }

      await conn.execute(
        'UPDATE coop_members SET linked_user_id = ? WHERE member_no = ?',
        [userId, memberNo]
      );

      await conn.commit();

      const updatedList = await listCooperativeMembers();
      const updatedMember = updatedList.find((x) => x.memberNo === memberNo);
      return { success: true, member: updatedMember! };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  // Memory fallback
  globalThis.__tributeCoopMembersStore = globalThis.__tributeCoopMembersStore || [];
  const memberIndex = globalThis.__tributeCoopMembersStore.findIndex((m) => m.memberNo === memberNo);
  if (memberIndex === -1) {
    throw new Error(`Cooperative member "${memberNo}" not found.`);
  }

  const existingUserLink = globalThis.__tributeCoopMembersStore.find((m) => m.linkedUserId === userId);
  if (existingUserLink) {
    throw new DuplicateMemberError(
      `User ID ${userId} is already linked to cooperative member ${existingUserLink.memberNo}`
    );
  }

  const target = globalThis.__tributeCoopMembersStore[memberIndex];
  if (target.linkedUserId) {
    throw new DuplicateMemberError(
      `Member ${memberNo} is already linked to user ID ${target.linkedUserId}`
    );
  }

  target.linkedUserId = userId;
  target.updatedAt = new Date().toISOString();
  return { success: true, member: { ...target } };
}

export async function registerCooperativeMember(input: RegisterMemberInput): Promise<CooperativeMember> {
  // Validate Basic Personal Fields
  if (!input.firstName?.trim() || !input.lastName?.trim()) {
    throw new Error('First name and last name are required.');
  }
  if (!input.email?.trim() || !input.email.includes('@')) {
    throw new Error('A valid email address is required.');
  }
  if (!input.contactNumber?.trim()) {
    throw new Error('Contact number is required.');
  }
  if (!input.validIdType || !input.validIdNumber) {
    throw new Error('Valid identification type and ID number are required.');
  }

  // STRICT VALIDATION FOR ALL 3 EVIDENCE ITEMS
  if (!input.signatureData || typeof input.signatureData !== 'string' || input.signatureData.trim().length === 0) {
    throw new Error('Member digital signature is strictly required.');
  }
  if (!input.photoUrl || typeof input.photoUrl !== 'string' || input.photoUrl.trim().length === 0) {
    throw new Error('Member profile photo is strictly required.');
  }
  if (!input.idSelfieUrl || typeof input.idSelfieUrl !== 'string' || input.idSelfieUrl.trim().length === 0) {
    throw new Error('Member selfie holding valid ID is strictly required.');
  }

  const normalizedEmail = input.email.toLowerCase().trim();
  const nowIso = new Date().toISOString();
  const signatureAuthId = `AUTH-SIG-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const fullName = [input.firstName, input.middleName, input.lastName, input.suffix]
    .filter(Boolean)
    .join(' ')
    .trim();

  // ATOMIC DATABASE PATH WHEN CONFIGURED
  if (isDatabaseConfigured()) {
    const db = await import('./db');
    const pool = db.getDbPool();

    let attempt = 0;
    const maxAttempts = 3;

    while (attempt < maxAttempts) {
      attempt++;
      let conn: PoolConnection | null = null;

      try {
        conn = await pool.getConnection();
        await conn.beginTransaction();

        // 1. Duplicate email check within transaction
        const [existing] = (await conn.execute(
          'SELECT id, member_no, email FROM coop_members WHERE LOWER(email) = ? LIMIT 1 FOR UPDATE',
          [normalizedEmail]
        )) as unknown as [Record<string, unknown>[]];

        if (existing && existing.length > 0) {
          throw new DuplicateMemberError(
            `A cooperative member with email "${input.email}" already exists (Member No: ${existing[0].member_no}).`
          );
        }

        const memberNo = generateMemberNo();

        // 2. Insert member record
        const [insertRes] = (await conn.execute(
          `INSERT INTO coop_members
           (member_no, linked_user_id, first_name, middle_name, last_name, suffix, full_name, gender, date_of_birth, civil_status,
            email, contact_number, address, barangay, city, province, occupation, monthly_income,
            signature_data, signature_auth_id, signature_timestamp, photo_url, photo_timestamp,
            id_selfie_url, id_selfie_timestamp, valid_id_type, valid_id_number,
            registration_fee, capital_share, initial_savings, total_paid, payment_method, payment_reference,
            registered_by_id, registered_by_name, registered_by_role, registration_status)
           VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
          [
            memberNo,
            input.firstName.trim(),
            input.middleName?.trim() || null,
            input.lastName.trim(),
            input.suffix?.trim() || null,
            fullName,
            input.gender,
            input.dateOfBirth,
            input.civilStatus,
            normalizedEmail,
            input.contactNumber.trim(),
            input.address.trim(),
            input.barangay.trim(),
            input.city.trim(),
            input.province.trim(),
            input.occupation.trim(),
            Number(input.monthlyIncome) || 0,
            input.signatureData,
            signatureAuthId,
            new Date(nowIso),
            input.photoUrl,
            new Date(nowIso),
            input.idSelfieUrl,
            new Date(nowIso),
            input.validIdType.trim(),
            input.validIdNumber.trim(),
            MEMBER_FEES.REGISTRATION_FEE,
            MEMBER_FEES.CAPITAL_SHARE,
            MEMBER_FEES.INITIAL_SAVINGS,
            MEMBER_FEES.TOTAL_PAYMENT,
            input.paymentMethod || 'cash',
            input.paymentReference?.trim() || `REC-${Date.now().toString().slice(-6)}`,
            input.registeredById || null,
            input.registeredByName || 'Cooperative Registrar',
            input.registeredByRole || 'account_officer',
          ]
        )) as unknown as [{ insertId: number }];

        const newId = insertRes.insertId;
        const payRef = input.paymentReference?.trim() || `REC-${Date.now().toString().slice(-6)}`;
        const regName = input.registeredByName || 'Cooperative Registrar';

        // 3. Insert all three ledger entries in same atomic transaction
        await conn.execute(
          `INSERT INTO coop_member_transactions (member_id, member_no, transaction_type, amount, reference_no, recorded_by_name)
           VALUES
           (?, ?, 'registration_fee', 500.00, ?, ?),
           (?, ?, 'capital_share', 2000.00, ?, ?),
           (?, ?, 'savings_deposit', 500.00, ?, ?)`,
          [
            newId, memberNo, `FEE-${payRef}`, regName,
            newId, memberNo, `CS-${payRef}`, regName,
            newId, memberNo, `SAV-${payRef}`, regName,
          ]
        );

        // Commit transaction atomically
        await conn.commit();

        const createdMember: CooperativeMember = {
          id: newId,
          memberNo,
          linkedUserId: null,
          firstName: input.firstName.trim(),
          middleName: input.middleName?.trim() || undefined,
          lastName: input.lastName.trim(),
          suffix: input.suffix?.trim() || undefined,
          fullName,
          gender: input.gender,
          dateOfBirth: input.dateOfBirth,
          civilStatus: input.civilStatus,
          email: normalizedEmail,
          contactNumber: input.contactNumber.trim(),
          address: input.address.trim(),
          barangay: input.barangay.trim(),
          city: input.city.trim(),
          province: input.province.trim(),
          occupation: input.occupation.trim(),
          monthlyIncome: Number(input.monthlyIncome) || 0,
          signatureData: input.signatureData,
          signatureAuthId,
          signatureTimestamp: nowIso,
          photoUrl: input.photoUrl,
          photoTimestamp: nowIso,
          idSelfieUrl: input.idSelfieUrl,
          idSelfieTimestamp: nowIso,
          validIdType: input.validIdType.trim(),
          validIdNumber: input.validIdNumber.trim(),
          registrationFee: MEMBER_FEES.REGISTRATION_FEE,
          capitalShare: MEMBER_FEES.CAPITAL_SHARE,
          initialSavings: MEMBER_FEES.INITIAL_SAVINGS,
          totalPaid: MEMBER_FEES.TOTAL_PAYMENT,
          paymentMethod: input.paymentMethod || 'cash',
          paymentReference: payRef,
          registeredById: input.registeredById,
          registeredByName: regName,
          registeredByRole: input.registeredByRole || 'account_officer',
          registrationStatus: 'active',
          createdAt: nowIso,
          updatedAt: nowIso,
        };

        return createdMember;
      } catch (err: unknown) {
        if (conn) {
          try {
            await conn.rollback();
          } catch {
            // Ignore rollback errors
          }
        }

        // Duplicate member number conflict: retry bounded
        const isDup = err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'ER_DUP_ENTRY';
        const msg = err instanceof Error ? err.message : String(err);

        if (isDup && msg.includes('member_no') && attempt < maxAttempts) {
          continue; // Retry with next unique member number
        }

        if (err instanceof DuplicateMemberError) {
          throw err;
        }

        if (isDup && msg.includes('email')) {
          throw new DuplicateMemberError(
            `A cooperative member with email "${input.email}" already exists.`
          );
        }

        // Genuine database failure: must NEVER silently fall back to memory
        throw new DatabasePersistenceError(`Database registration transaction failed: ${msg}`);
      } finally {
        if (conn) {
          conn.release();
        }
      }
    }

    throw new DatabasePersistenceError('Exceeded maximum retry attempts for unique member number generation.');
  }

  // IN-MEMORY FALLBACK (For local test runners when no DB is configured)
  const existingList = globalThis.__tributeCoopMembersStore || [];
  const duplicate = existingList.find((m) => m.email.toLowerCase().trim() === normalizedEmail);
  if (duplicate) {
    throw new DuplicateMemberError(
      `A cooperative member with email "${input.email}" already exists (Member No: ${duplicate.memberNo}).`
    );
  }

  const memberNo = generateMemberNo();
  const newMember: CooperativeMember = {
    id: memberNo,
    memberNo,
    linkedUserId: null,
    firstName: input.firstName.trim(),
    middleName: input.middleName?.trim() || undefined,
    lastName: input.lastName.trim(),
    suffix: input.suffix?.trim() || undefined,
    fullName,
    gender: input.gender,
    dateOfBirth: input.dateOfBirth,
    civilStatus: input.civilStatus,
    email: normalizedEmail,
    contactNumber: input.contactNumber.trim(),
    address: input.address.trim(),
    barangay: input.barangay.trim(),
    city: input.city.trim(),
    province: input.province.trim(),
    occupation: input.occupation.trim(),
    monthlyIncome: Number(input.monthlyIncome) || 0,
    signatureData: input.signatureData,
    signatureAuthId,
    signatureTimestamp: nowIso,
    photoUrl: input.photoUrl,
    photoTimestamp: nowIso,
    idSelfieUrl: input.idSelfieUrl,
    idSelfieTimestamp: nowIso,
    validIdType: input.validIdType.trim(),
    validIdNumber: input.validIdNumber.trim(),
    registrationFee: MEMBER_FEES.REGISTRATION_FEE,
    capitalShare: MEMBER_FEES.CAPITAL_SHARE,
    initialSavings: MEMBER_FEES.INITIAL_SAVINGS,
    totalPaid: MEMBER_FEES.TOTAL_PAYMENT,
    paymentMethod: input.paymentMethod || 'cash',
    paymentReference: input.paymentReference?.trim() || `REC-${Date.now().toString().slice(-6)}`,
    registeredById: input.registeredById,
    registeredByName: input.registeredByName || 'Cooperative Registrar',
    registeredByRole: input.registeredByRole || 'account_officer',
    registrationStatus: 'active',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  globalThis.__tributeCoopMembersStore = globalThis.__tributeCoopMembersStore || [];
  globalThis.__tributeCoopMembersStore.unshift(newMember);

  const txList = globalThis.__tributeCoopMemberTransactions || [];
  txList.push(
    {
      memberId: newMember.id,
      memberNo: newMember.memberNo,
      transactionType: 'registration_fee',
      amount: MEMBER_FEES.REGISTRATION_FEE,
      referenceNo: `FEE-${newMember.paymentReference}`,
      recordedByName: newMember.registeredByName,
      createdAt: nowIso,
    },
    {
      memberId: newMember.id,
      memberNo: newMember.memberNo,
      transactionType: 'capital_share',
      amount: MEMBER_FEES.CAPITAL_SHARE,
      referenceNo: `CS-${newMember.paymentReference}`,
      recordedByName: newMember.registeredByName,
      createdAt: nowIso,
    },
    {
      memberId: newMember.id,
      memberNo: newMember.memberNo,
      transactionType: 'savings_deposit',
      amount: MEMBER_FEES.INITIAL_SAVINGS,
      referenceNo: `SAV-${newMember.paymentReference}`,
      recordedByName: newMember.registeredByName,
      createdAt: nowIso,
    }
  );
  globalThis.__tributeCoopMemberTransactions = txList;

  return newMember;
}
