import type { PoolConnection } from 'mysql2/promise';

let coopMemberSchemaEnsured = false;

/**
 * Ensures `coop_members` has all columns required by the current application
 * (idempotent, runs at most once per server process before any transaction).
 */
export async function ensureCoopMemberSchema(conn: PoolConnection): Promise<void> {
  if (coopMemberSchemaEnsured) return;

  const [cols] = (await conn.execute('SHOW COLUMNS FROM coop_members')) as unknown as [
    Array<{ Field: string; Null: string }>
  ];
  const existing = new Map(cols.map((c) => [c.Field, c]));

  const missingColumnDefs: Array<{ name: string; ddl: string }> = [
    {
      name: 'linked_user_id',
      ddl: 'ADD COLUMN `linked_user_id` INT NULL UNIQUE AFTER `member_no`',
    },
    {
      name: 'membership_type',
      ddl: "ADD COLUMN `membership_type` ENUM('full_cooperative', 'borrower_only') NOT NULL DEFAULT 'full_cooperative' AFTER `linked_user_id`",
    },
    {
      name: 'signature_auth_id',
      ddl: 'ADD COLUMN `signature_auth_id` VARCHAR(100) NULL AFTER `signature_data`',
    },
    {
      name: 'valid_id_type',
      ddl: 'ADD COLUMN `valid_id_type` VARCHAR(100) NULL AFTER `id_selfie_timestamp`',
    },
    {
      name: 'valid_id_number',
      ddl: 'ADD COLUMN `valid_id_number` VARCHAR(100) NULL AFTER `valid_id_type`',
    },
  ];

  for (const col of missingColumnDefs) {
    if (!existing.has(col.name)) {
      await conn.execute(`ALTER TABLE coop_members ${col.ddl}`);
    }
  }

  // Ensure columns that are nullable for provisional borrower_only members allow NULL
  const nullableColumnDefs: Array<{ name: string; ddl: string }> = [
    { name: 'middle_name', ddl: 'MODIFY COLUMN `middle_name` VARCHAR(100) NULL' },
    { name: 'suffix', ddl: 'MODIFY COLUMN `suffix` VARCHAR(20) NULL' },
    { name: 'gender', ddl: "MODIFY COLUMN `gender` ENUM('Male', 'Female', 'Other') NULL" },
    { name: 'date_of_birth', ddl: 'MODIFY COLUMN `date_of_birth` DATE NULL' },
    { name: 'civil_status', ddl: "MODIFY COLUMN `civil_status` ENUM('Single', 'Married', 'Widowed', 'Separated', 'Divorced') NULL" },
    { name: 'signature_data', ddl: 'MODIFY COLUMN `signature_data` LONGTEXT NULL' },
    { name: 'signature_auth_id', ddl: 'MODIFY COLUMN `signature_auth_id` VARCHAR(100) NULL' },
    { name: 'signature_timestamp', ddl: 'MODIFY COLUMN `signature_timestamp` TIMESTAMP NULL' },
    { name: 'photo_url', ddl: 'MODIFY COLUMN `photo_url` LONGTEXT NULL' },
    { name: 'photo_timestamp', ddl: 'MODIFY COLUMN `photo_timestamp` TIMESTAMP NULL' },
    { name: 'id_selfie_url', ddl: 'MODIFY COLUMN `id_selfie_url` LONGTEXT NULL' },
    { name: 'id_selfie_timestamp', ddl: 'MODIFY COLUMN `id_selfie_timestamp` TIMESTAMP NULL' },
    { name: 'valid_id_type', ddl: 'MODIFY COLUMN `valid_id_type` VARCHAR(100) NULL' },
    { name: 'valid_id_number', ddl: 'MODIFY COLUMN `valid_id_number` VARCHAR(100) NULL' },
    { name: 'payment_reference', ddl: 'MODIFY COLUMN `payment_reference` VARCHAR(100) NULL' },
    { name: 'registered_by_id', ddl: 'MODIFY COLUMN `registered_by_id` INT NULL' },
  ];

  for (const col of nullableColumnDefs) {
    const info = existing.get(col.name);
    if (info && info.Null === 'NO') {
      await conn.execute(`ALTER TABLE coop_members ${col.ddl}`);
    }
  }

  coopMemberSchemaEnsured = true;
}

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

export type MembershipType = 'full_cooperative' | 'borrower_only';

export interface CooperativeMember {
  id: number | string;
  memberNo: string; // e.g. TCID-M-2026-0001
  linkedUserId?: number | null; // Nullable link to users table for future borrower/applicant conversion
  membershipType: MembershipType;
  firstName: string;
  middleName?: string;
  lastName: string;
  suffix?: string;
  fullName: string;
  gender?: 'Male' | 'Female' | 'Other' | null;
  dateOfBirth?: string | null;
  civilStatus?: 'Single' | 'Married' | 'Widowed' | 'Separated' | 'Divorced' | null;
  email: string;
  contactNumber: string;
  address: string;
  barangay: string;
  city: string;
  province: string;
  occupation: string;
  monthlyIncome: number;

  // 3 Mandatory Identity & Evidence items (nullable for provisional borrower-only members)
  signatureData?: string | null;
  signatureAuthId?: string | null;
  signatureTimestamp?: string | null;
  photoUrl?: string | null;
  photoTimestamp?: string | null;
  idSelfieUrl?: string | null;
  idSelfieTimestamp?: string | null;
  validIdType?: string | null;
  validIdNumber?: string | null;

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

export interface ProvisionalBorrowerInput {
  linkedUserId?: number | null;
  name: string;
  email: string;
  contactNumber: string;
  address?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  suffix?: string;
  gender?: 'Male' | 'Female' | 'Other' | null;
  dateOfBirth?: string | null;
  civilStatus?: 'Single' | 'Married' | 'Widowed' | 'Separated' | 'Divorced' | null;
  barangay?: string;
  city?: string;
  province?: string;
  occupation?: string;
  monthlyIncome?: number;
  validIdType?: string | null;
  validIdNumber?: string | null;
  applicantSignature?: string | null;
  signatureAuthId?: string | null;
  applicantPhoto?: string | null;
  holdingIdPhoto?: string | null;
  recordedById?: number | null;
  recordedByName?: string;
  recordedByRole?: 'admin' | 'account_officer';
}

export interface MemberTransactionRecord {
  id?: number;
  memberId: number | string;
  memberNo: string;
  transactionType: 'registration_fee' | 'capital_share' | 'savings_deposit';
  amount: number;
  referenceNo: string;
  recordedByName: string;
  recordedById?: number | null;
  recordedByRole?: 'admin' | 'account_officer';
  auditId?: string;
  paymentMethod?: 'cash' | 'online' | 'bank_transfer';
  paymentReference?: string;
  requestComponent?: 'registration_fee' | 'capital_share' | 'savings_deposit' | 'all';
  createdAt: string;
}

export interface MemberPaymentInput {
  memberNo: string;
  component: 'registration_fee' | 'capital_share' | 'savings_deposit' | 'all';
  amount: number;
  paymentMethod?: 'cash' | 'online' | 'bank_transfer';
  paymentReference?: string;
  recordedById?: number | null;
  recordedByName?: string;
  recordedByRole?: 'admin' | 'account_officer';
  auditId?: string;
}

export interface PaymentAuditInfo {
  recordedById?: number | null;
  recordedByName: string;
  recordedByRole: 'admin' | 'account_officer';
  auditId: string;
  paymentReference: string;
  paymentMethod: 'cash' | 'online' | 'bank_transfer';
  isReplay: boolean;
}

export interface PaymentResult {
  member: CooperativeMember;
  remainingBalances: {
    registrationFee: number;
    capitalShare: number;
    initialSavings: number;
    totalRemaining: number;
  };
  audit: PaymentAuditInfo;
}

export class PaymentConflictError extends Error {
  code = 'PAYMENT_CONFLICT';
  statusCode = 409;
  constructor(message: string) {
    super(message);
    this.name = 'PaymentConflictError';
  }
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

export async function listCooperativeMembers(
  searchQuery = '',
  filterType?: MembershipType
): Promise<CooperativeMember[]> {
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
          membershipType: (r.membership_type as MembershipType) || 'full_cooperative',
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

        if (filterType) {
          result = result.filter((m) => m.membershipType === filterType);
        }

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
  if (filterType) {
    memoryList = memoryList.filter((m) => m.membershipType === filterType);
  }
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

// Strict Real-Time Member Detection (Non-fuzzy)
export async function findMatchingCooperativeMember(params: {
  memberNo?: string;
  email?: string;
  contactNumber?: string;
  dateOfBirth?: string;
}): Promise<CooperativeMember | null> {
  const normMemberNo = params.memberNo?.trim().toUpperCase();
  const normEmail = params.email?.trim().toLowerCase();
  const normPhone = params.contactNumber?.replace(/[^0-9]/g, '');
  const normDob = params.dateOfBirth?.trim();

  const members = await listCooperativeMembers();

  // 1. Exact Member Number match
  if (normMemberNo) {
    const matched = members.find((m) => m.memberNo.toUpperCase() === normMemberNo);
    if (matched) return matched;
  }

  // 2. Exact Normalized Email match
  if (normEmail && normEmail.includes('@')) {
    const matched = members.find((m) => m.email.toLowerCase() === normEmail);
    if (matched) return matched;
  }

  // 3. Exact Compound Match: Phone AND Date of Birth (both required)
  if (normPhone && normPhone.length >= 7 && normDob) {
    const matched = members.find((m) => {
      const mPhone = m.contactNumber.replace(/[^0-9]/g, '');
      const mDob = m.dateOfBirth ? new Date(m.dateOfBirth).toISOString().slice(0, 10) : '';
      const inputDob = new Date(normDob).toISOString().slice(0, 10);
      return mPhone.endsWith(normPhone.slice(-7)) && mDob === inputDob;
    });
    if (matched) return matched;
  }

  // Zero fuzzy name-only matching allowed!
  return null;
}

// Automatic Provisional Borrower-Only Member Creation
export async function createProvisionalBorrowerMember(
  input: ProvisionalBorrowerInput
): Promise<CooperativeMember> {
  const normalizedEmail = (input.email || `borrower.${Date.now()}@tribute.coop`).toLowerCase().trim();
  const existingList = await listCooperativeMembers();

  // If user is already linked or email exists, return existing
  if (input.linkedUserId) {
    const matchedUser = existingList.find((m) => m.linkedUserId === input.linkedUserId);
    if (matchedUser) return matchedUser;
  }
  const matchedEmail = existingList.find((m) => m.email.toLowerCase() === normalizedEmail);
  if (matchedEmail) return matchedEmail;

  // Derive name fields without fabricating dummy identities
  const parts = input.name.trim().split(/\s+/);
  const firstName = input.firstName?.trim() || parts[0] || 'Borrower';
  const middleName = input.middleName?.trim() || (parts.length > 2 ? parts.slice(1, -1).join(' ') : null);
  const lastName = input.lastName?.trim() || (parts.length > 1 ? parts[parts.length - 1] : 'Member');
  const suffix = input.suffix?.trim() || null;
  const fullName = input.name.trim() || [firstName, middleName, lastName, suffix].filter(Boolean).join(' ');

  const memberNo = generateMemberNo();
  const nowIso = new Date().toISOString();

  // Keep nullable fields strictly null if unknown; NEVER fabricate 1990-01-01, Male, etc.
  const gender = input.gender || null;
  const dateOfBirth = input.dateOfBirth?.trim() || null;
  const civilStatus = input.civilStatus || null;
  const contactNumber = input.contactNumber?.trim() || '';
  const address = input.address?.trim() || '';
  const barangay = input.barangay?.trim() || '';
  const city = input.city?.trim() || '';
  const province = input.province?.trim() || '';
  const occupation = input.occupation?.trim() || '';
  const monthlyIncome = typeof input.monthlyIncome === 'number' && Number.isFinite(input.monthlyIncome) ? input.monthlyIncome : 0;

  const validIdType = input.validIdType?.trim() || null;
  const validIdNumber = input.validIdNumber?.trim() || null;

  const signatureData = input.applicantSignature || null;
  // NEVER fabricate SIG-PROV; carry real authId if present, otherwise null
  const signatureAuthId = input.signatureAuthId?.trim() || null;
  const photoUrl = input.applicantPhoto || null;
  const idSelfieUrl = input.holdingIdPhoto || null;

  if (isDatabaseConfigured()) {
    const db = await import('./db');
    const pool = db.getDbPool();
    let conn: PoolConnection | null = null;

    try {
      conn = await pool.getConnection();
      await conn.beginTransaction();

      // Check for concurrent race insertion before insert
      const [existingRows] = (await conn.execute(
        `SELECT * FROM coop_members WHERE email = ? ${input.linkedUserId ? 'OR linked_user_id = ?' : ''} LIMIT 1 FOR UPDATE`,
        input.linkedUserId ? [normalizedEmail, input.linkedUserId] : [normalizedEmail]
      )) as unknown as [Record<string, unknown>[]];

      if (existingRows && existingRows.length > 0) {
        await conn.commit();
        const r = existingRows[0];
        return {
          id: r.id as number | string,
          memberNo: r.member_no as string,
          linkedUserId: (r.linked_user_id as number) || null,
          membershipType: (r.membership_type as MembershipType) || 'borrower_only',
          firstName: r.first_name as string,
          middleName: (r.middle_name as string) || undefined,
          lastName: r.last_name as string,
          suffix: (r.suffix as string) || undefined,
          fullName: r.full_name as string,
          gender: (r.gender as CooperativeMember['gender']) || null,
          dateOfBirth: r.date_of_birth ? new Date(r.date_of_birth as string).toISOString().slice(0, 10) : null,
          civilStatus: (r.civil_status as CooperativeMember['civilStatus']) || null,
          email: r.email as string,
          contactNumber: (r.contact_number as string) || '',
          address: (r.address as string) || '',
          barangay: (r.barangay as string) || '',
          city: (r.city as string) || '',
          province: (r.province as string) || '',
          occupation: (r.occupation as string) || '',
          monthlyIncome: Number(r.monthly_income) || 0,
          signatureData: (r.signature_data as string) || null,
          signatureAuthId: (r.signature_auth_id as string) || null,
          signatureTimestamp: r.signature_timestamp ? new Date(r.signature_timestamp as string).toISOString() : null,
          photoUrl: (r.photo_url as string) || null,
          photoTimestamp: r.photo_timestamp ? new Date(r.photo_timestamp as string).toISOString() : null,
          idSelfieUrl: (r.id_selfie_url as string) || null,
          idSelfieTimestamp: r.id_selfie_timestamp ? new Date(r.id_selfie_timestamp as string).toISOString() : null,
          validIdType: (r.valid_id_type as string) || null,
          validIdNumber: (r.valid_id_number as string) || null,
          registrationFee: Number(r.registration_fee) || 0,
          capitalShare: Number(r.capital_share) || 0,
          initialSavings: Number(r.initial_savings) || 0,
          totalPaid: Number(r.total_paid) || 0,
          paymentMethod: (r.payment_method as CooperativeMember['paymentMethod']) || 'cash',
          paymentReference: (r.payment_reference as string) || undefined,
          registeredById: (r.registered_by_id as number) || undefined,
          registeredByName: (r.registered_by_name as string) || 'Loan Onboarding System',
          registeredByRole: (r.registered_by_role as CooperativeMember['registeredByRole']) || 'account_officer',
          registrationStatus: (r.registration_status as CooperativeMember['registrationStatus']) || 'active',
          createdAt: r.created_at ? new Date(r.created_at as string).toISOString() : nowIso,
          updatedAt: r.updated_at ? new Date(r.updated_at as string).toISOString() : nowIso,
        };
      }

      const [insertRes] = (await conn.execute(
        `INSERT INTO coop_members
         (member_no, linked_user_id, membership_type, first_name, middle_name, last_name, suffix, full_name, gender, date_of_birth, civil_status,
          email, contact_number, address, barangay, city, province, occupation, monthly_income,
          signature_data, signature_auth_id, signature_timestamp, photo_url, photo_timestamp,
          id_selfie_url, id_selfie_timestamp, valid_id_type, valid_id_number,
          registration_fee, capital_share, initial_savings, total_paid, payment_method, payment_reference,
          registered_by_id, registered_by_name, registered_by_role, registration_status)
         VALUES (?, ?, 'borrower_only', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.00, 0.00, 0.00, 0.00, 'cash', 'PENDING-ONBOARDING', ?, ?, ?, 'active')`,
        [
          memberNo,
          input.linkedUserId || null,
          firstName,
          middleName,
          lastName,
          suffix,
          fullName,
          gender,
          dateOfBirth,
          civilStatus,
          normalizedEmail,
          contactNumber,
          address,
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
          input.recordedById || null,
          input.recordedByName || 'Loan Onboarding System',
          input.recordedByRole || 'account_officer',
        ]
      )) as unknown as [{ insertId: number }];

      await conn.commit();

      const newId = insertRes.insertId;
      return {
        id: newId,
        memberNo,
        linkedUserId: input.linkedUserId || null,
        membershipType: 'borrower_only',
        firstName,
        middleName: middleName || undefined,
        lastName,
        suffix: suffix || undefined,
        fullName,
        gender,
        dateOfBirth,
        civilStatus,
        email: normalizedEmail,
        contactNumber,
        address,
        barangay,
        city,
        province,
        occupation,
        monthlyIncome,
        signatureData,
        signatureAuthId,
        signatureTimestamp: signatureData ? nowIso : null,
        photoUrl,
        photoTimestamp: photoUrl ? nowIso : null,
        idSelfieUrl,
        idSelfieTimestamp: idSelfieUrl ? nowIso : null,
        validIdType,
        validIdNumber,
        registrationFee: 0,
        capitalShare: 0,
        initialSavings: 0,
        totalPaid: 0,
        paymentMethod: 'cash',
        paymentReference: 'PENDING-ONBOARDING',
        registeredById: input.recordedById || undefined,
        registeredByName: input.recordedByName || 'Loan Onboarding System',
        registeredByRole: input.recordedByRole || 'account_officer',
        registrationStatus: 'active',
        createdAt: nowIso,
        updatedAt: nowIso,
      };
    } catch (err: unknown) {
      if (conn) {
        try {
          await conn.rollback();
        } catch {}
      }
      // Handle ER_DUP_ENTRY duplicate race by reading the existing record
      const isDupEntry = err && typeof err === 'object' && ('code' in err && (err as { code: string }).code === 'ER_DUP_ENTRY');
      if (isDupEntry) {
        try {
          const [winnerRows] = (await pool.execute(
            `SELECT * FROM coop_members WHERE email = ? ${input.linkedUserId ? 'OR linked_user_id = ?' : ''} LIMIT 1`,
            input.linkedUserId ? [normalizedEmail, input.linkedUserId] : [normalizedEmail]
          )) as unknown as [Record<string, unknown>[]];

          if (winnerRows && winnerRows.length > 0) {
            const r = winnerRows[0];
            return {
              id: r.id as number | string,
              memberNo: r.member_no as string,
              linkedUserId: (r.linked_user_id as number) || null,
              membershipType: (r.membership_type as MembershipType) || 'borrower_only',
              firstName: r.first_name as string,
              middleName: (r.middle_name as string) || undefined,
              lastName: r.last_name as string,
              suffix: (r.suffix as string) || undefined,
              fullName: r.full_name as string,
              gender: (r.gender as CooperativeMember['gender']) || null,
              dateOfBirth: r.date_of_birth ? new Date(r.date_of_birth as string).toISOString().slice(0, 10) : null,
              civilStatus: (r.civil_status as CooperativeMember['civilStatus']) || null,
              email: r.email as string,
              contactNumber: (r.contact_number as string) || '',
              address: (r.address as string) || '',
              barangay: (r.barangay as string) || '',
              city: (r.city as string) || '',
              province: (r.province as string) || '',
              occupation: (r.occupation as string) || '',
              monthlyIncome: Number(r.monthly_income) || 0,
              signatureData: (r.signature_data as string) || null,
              signatureAuthId: (r.signature_auth_id as string) || null,
              signatureTimestamp: r.signature_timestamp ? new Date(r.signature_timestamp as string).toISOString() : null,
              photoUrl: (r.photo_url as string) || null,
              photoTimestamp: r.photo_timestamp ? new Date(r.photo_timestamp as string).toISOString() : null,
              idSelfieUrl: (r.id_selfie_url as string) || null,
              idSelfieTimestamp: r.id_selfie_timestamp ? new Date(r.id_selfie_timestamp as string).toISOString() : null,
              validIdType: (r.valid_id_type as string) || null,
              validIdNumber: (r.valid_id_number as string) || null,
              registrationFee: Number(r.registration_fee) || 0,
              capitalShare: Number(r.capital_share) || 0,
              initialSavings: Number(r.initial_savings) || 0,
              totalPaid: Number(r.total_paid) || 0,
              paymentMethod: (r.payment_method as CooperativeMember['paymentMethod']) || 'cash',
              paymentReference: (r.payment_reference as string) || undefined,
              registeredById: (r.registered_by_id as number) || undefined,
              registeredByName: (r.registered_by_name as string) || 'Loan Onboarding System',
              registeredByRole: (r.registered_by_role as CooperativeMember['registeredByRole']) || 'account_officer',
              registrationStatus: (r.registration_status as CooperativeMember['registrationStatus']) || 'active',
              createdAt: r.created_at ? new Date(r.created_at as string).toISOString() : nowIso,
              updatedAt: r.updated_at ? new Date(r.updated_at as string).toISOString() : nowIso,
            };
          }
        } catch {}
      }
      const msg = err instanceof Error ? err.message : String(err);
      throw new DatabasePersistenceError(`Failed to create provisional borrower member: ${msg}`);
    } finally {
      if (conn) conn.release();
    }
  }

  // In-memory fallback
  const provisional: CooperativeMember = {
    id: memberNo,
    memberNo,
    linkedUserId: input.linkedUserId || null,
    membershipType: 'borrower_only',
    firstName,
    middleName: middleName || undefined,
    lastName,
    suffix: suffix || undefined,
    fullName,
    gender,
    dateOfBirth,
    civilStatus,
    email: normalizedEmail,
    contactNumber,
    address,
    barangay,
    city,
    province,
    occupation,
    monthlyIncome,
    signatureData,
    signatureAuthId,
    signatureTimestamp: signatureData ? nowIso : null,
    photoUrl,
    photoTimestamp: photoUrl ? nowIso : null,
    idSelfieUrl,
    idSelfieTimestamp: idSelfieUrl ? nowIso : null,
    validIdType,
    validIdNumber,
    registrationFee: 0,
    capitalShare: 0,
    initialSavings: 0,
    totalPaid: 0,
    paymentMethod: 'cash',
    paymentReference: 'PENDING-ONBOARDING',
    registeredById: input.recordedById || undefined,
    registeredByName: input.recordedByName || 'Loan Onboarding System',
    registeredByRole: input.recordedByRole || 'account_officer',
    registrationStatus: 'active',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  globalThis.__tributeCoopMembersStore = globalThis.__tributeCoopMembersStore || [];
  globalThis.__tributeCoopMembersStore.unshift(provisional);
  return provisional;
}

// Record Membership Payment & Automatic Promotion (With SELECT ... FOR UPDATE & Idempotency Protection)
export async function recordMembershipPayment(input: MemberPaymentInput): Promise<PaymentResult> {
  if (!input.memberNo || typeof input.amount !== 'number' || !Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error('Valid memberNo and finite positive decimal amount are strictly required.');
  }

  const payRef = input.paymentReference?.trim() || `REC-${Date.now().toString().slice(-6)}`;
  const actorName = input.recordedByName || 'Cooperative Officer';
  const actorId = input.recordedById || null;
  const actorRole = input.recordedByRole || 'account_officer';
  const payMethod = input.paymentMethod || 'cash';
  const auditId = input.auditId || `AUD-PAY-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

  if (isDatabaseConfigured()) {
    const db = await import('./db');
    const pool = db.getDbPool();
    let conn: PoolConnection | null = null;

    try {
      conn = await pool.getConnection();
      await conn.beginTransaction();

      // 1. SELECT FOR UPDATE to lock target coop_members row
      const [members] = (await conn.execute(
        'SELECT * FROM coop_members WHERE member_no = ? LIMIT 1 FOR UPDATE',
        [input.memberNo]
      )) as unknown as [Record<string, unknown>[]];

      if (!members || members.length === 0) {
        throw new Error(`Cooperative member "${input.memberNo}" not found.`);
      }

      const m = members[0];

      // 2. Idempotency Check: check if this exact receipt/payment reference has already been recorded
      const [existingTxns] = (await conn.execute(
        'SELECT * FROM coop_member_transactions WHERE member_no = ? AND payment_reference = ?',
        [input.memberNo, payRef]
      )) as unknown as [Record<string, unknown>[]];

      if (existingTxns && existingTxns.length > 0) {
        // Compare retry fingerprint with original payment
        const origTotalAmount = existingTxns.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
        const origMethod = (existingTxns[0].payment_method as string) || 'cash';
        const origComponent =
          (existingTxns[0].request_component as MemberPaymentInput['component'] | null) ||
          (existingTxns.length > 1
            ? 'all'
            : (existingTxns[0].transaction_type as MemberPaymentInput['component']));
        const origAuditId = (existingTxns[0].audit_id as string) || '';
        const origActorId = (existingTxns[0].recorded_by_id as number) || null;
        const origActorName = (existingTxns[0].recorded_by_name as string) || 'Cooperative Officer';
        const origActorRole = (existingTxns[0].recorded_by_role as CooperativeMember['registeredByRole']) || 'account_officer';

        // A replay is identical only when its amount, component, and method all match.
        const amountDiff = Math.abs(origTotalAmount - input.amount);
        if (
          amountDiff > 0.009 ||
          input.component !== origComponent ||
          (input.paymentMethod && input.paymentMethod !== origMethod)
        ) {
          await conn.rollback();
          throw new PaymentConflictError(
            `Payment reference "${payRef}" was already recorded for member ${input.memberNo} with a different payload (Original: ${origComponent}, ₱${origTotalAmount} via ${origMethod}; Attempted: ${input.component}, ₱${input.amount} via ${payMethod}).`
          );
        }

        // Identical replay: commit and return the originally stored audit metadata without double charging
        await conn.commit();
        const curFee = Number(m.registration_fee) || 0;
        const curCap = Number(m.capital_share) || 0;
        const curSav = Number(m.initial_savings) || 0;
        const curTotal = Number(m.total_paid) || 0;

        const currentMember: CooperativeMember = {
          id: m.id as number | string,
          memberNo: m.member_no as string,
          linkedUserId: (m.linked_user_id as number) || null,
          membershipType: (m.membership_type as MembershipType) || 'borrower_only',
          firstName: m.first_name as string,
          middleName: (m.middle_name as string) || undefined,
          lastName: m.last_name as string,
          suffix: (m.suffix as string) || undefined,
          fullName: m.full_name as string,
          gender: (m.gender as CooperativeMember['gender']) || null,
          dateOfBirth: m.date_of_birth ? new Date(m.date_of_birth as string).toISOString().slice(0, 10) : null,
          civilStatus: (m.civil_status as CooperativeMember['civilStatus']) || null,
          email: m.email as string,
          contactNumber: (m.contact_number as string) || '',
          address: (m.address as string) || '',
          barangay: (m.barangay as string) || '',
          city: (m.city as string) || '',
          province: (m.province as string) || '',
          occupation: (m.occupation as string) || '',
          monthlyIncome: Number(m.monthly_income) || 0,
          signatureData: (m.signature_data as string) || null,
          signatureAuthId: (m.signature_auth_id as string) || null,
          signatureTimestamp: m.signature_timestamp ? new Date(m.signature_timestamp as string).toISOString() : null,
          photoUrl: (m.photo_url as string) || null,
          photoTimestamp: m.photo_timestamp ? new Date(m.photo_timestamp as string).toISOString() : null,
          idSelfieUrl: (m.id_selfie_url as string) || null,
          idSelfieTimestamp: m.id_selfie_timestamp ? new Date(m.id_selfie_timestamp as string).toISOString() : null,
          validIdType: (m.valid_id_type as string) || null,
          validIdNumber: (m.valid_id_number as string) || null,
          registrationFee: curFee,
          capitalShare: curCap,
          initialSavings: curSav,
          totalPaid: curTotal,
          paymentMethod: (m.payment_method as CooperativeMember['paymentMethod']) || 'cash',
          paymentReference: (m.payment_reference as string) || payRef,
          registeredById: (m.registered_by_id as number) || undefined,
          registeredByName: (m.registered_by_name as string) || 'Cooperative Officer',
          registeredByRole: (m.registered_by_role as CooperativeMember['registeredByRole']) || 'account_officer',
          registrationStatus: (m.registration_status as CooperativeMember['registrationStatus']) || 'active',
          createdAt: m.created_at ? new Date(m.created_at as string).toISOString() : new Date().toISOString(),
          updatedAt: m.updated_at ? new Date(m.updated_at as string).toISOString() : new Date().toISOString(),
        };

        return {
          member: currentMember,
          remainingBalances: {
            registrationFee: Math.max(0, MEMBER_FEES.REGISTRATION_FEE - curFee),
            capitalShare: Math.max(0, MEMBER_FEES.CAPITAL_SHARE - curCap),
            initialSavings: Math.max(0, MEMBER_FEES.INITIAL_SAVINGS - curSav),
            totalRemaining: Math.max(0, MEMBER_FEES.TOTAL_PAYMENT - curTotal),
          },
          audit: {
            recordedById: origActorId,
            recordedByName: origActorName,
            recordedByRole: origActorRole,
            auditId: origAuditId,
            paymentReference: payRef,
            paymentMethod: origMethod as 'cash' | 'online' | 'bank_transfer',
            isReplay: true,
          },
        };
      }

      // 3. Recalculate remaining balances from the locked row
      const curFee = Number(m.registration_fee) || 0;
      const curCap = Number(m.capital_share) || 0;
      const curSav = Number(m.initial_savings) || 0;

      const remFee = Math.max(0, MEMBER_FEES.REGISTRATION_FEE - curFee);
      const remCap = Math.max(0, MEMBER_FEES.CAPITAL_SHARE - curCap);
      const remSav = Math.max(0, MEMBER_FEES.INITIAL_SAVINGS - curSav);

      let allocFee = 0;
      let allocCap = 0;
      let allocSav = 0;

      if (input.component === 'registration_fee') {
        if (remFee <= 0) throw new Error('Registration Fee is already fully paid (₱500.00).');
        if (input.amount > remFee) throw new Error(`Amount ₱${input.amount} exceeds remaining fee balance of ₱${remFee}.`);
        allocFee = input.amount;
      } else if (input.component === 'capital_share') {
        if (remCap <= 0) throw new Error('Capital Share is already fully paid (₱2,000.00).');
        if (input.amount > remCap) throw new Error(`Amount ₱${input.amount} exceeds remaining capital share balance of ₱${remCap}.`);
        allocCap = input.amount;
      } else if (input.component === 'savings_deposit') {
        if (remSav <= 0) throw new Error('Initial Savings is already fully paid (₱500.00).');
        if (input.amount > remSav) throw new Error(`Amount ₱${input.amount} exceeds remaining savings deposit balance of ₱${remSav}.`);
        allocSav = input.amount;
      } else if (input.component === 'all') {
        const totalRemaining = remFee + remCap + remSav;
        if (totalRemaining <= 0) throw new Error('All required membership components are already fully paid.');
        if (input.amount > totalRemaining) {
          throw new Error(`Amount ₱${input.amount} exceeds total remaining required balance of ₱${totalRemaining}.`);
        }

        let left = input.amount;
        allocFee = Math.min(left, remFee);
        left -= allocFee;
        allocCap = Math.min(left, remCap);
        left -= allocCap;
        allocSav = Math.min(left, remSav);
      }

      const totalAdded = allocFee + allocCap + allocSav;
      if (totalAdded <= 0) {
        throw new Error('Payment amount must be greater than zero.');
      }

      const newFee = curFee + allocFee;
      const newCap = curCap + allocCap;
      const newSav = curSav + allocSav;
      const newTotal = newFee + newCap + newSav;
      const isPromoted = newFee >= MEMBER_FEES.REGISTRATION_FEE && newCap >= MEMBER_FEES.CAPITAL_SHARE && newSav >= MEMBER_FEES.INITIAL_SAVINGS;
      const targetMembershipType: MembershipType = isPromoted ? 'full_cooperative' : (m.membership_type as MembershipType);

      // Record transaction ledger entries with authenticated audit fields
      if (allocFee > 0) {
        await conn.execute(
          `INSERT INTO coop_member_transactions
           (member_id, member_no, transaction_type, amount, reference_no, recorded_by_name, recorded_by_id, recorded_by_role, audit_id, payment_method, payment_reference, request_component)
           VALUES (?, ?, 'registration_fee', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [m.id as number, m.member_no as string, allocFee, `FEE-${payRef}`, actorName, actorId, actorRole, auditId, payMethod, payRef, input.component]
        );
      }
      if (allocCap > 0) {
        await conn.execute(
          `INSERT INTO coop_member_transactions
           (member_id, member_no, transaction_type, amount, reference_no, recorded_by_name, recorded_by_id, recorded_by_role, audit_id, payment_method, payment_reference, request_component)
           VALUES (?, ?, 'capital_share', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [m.id as number, m.member_no as string, allocCap, `CS-${payRef}`, actorName, actorId, actorRole, auditId, payMethod, payRef, input.component]
        );
      }
      if (allocSav > 0) {
        await conn.execute(
          `INSERT INTO coop_member_transactions
           (member_id, member_no, transaction_type, amount, reference_no, recorded_by_name, recorded_by_id, recorded_by_role, audit_id, payment_method, payment_reference, request_component)
           VALUES (?, ?, 'savings_deposit', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [m.id as number, m.member_no as string, allocSav, `SAV-${payRef}`, actorName, actorId, actorRole, auditId, payMethod, payRef, input.component]
        );
      }

      // Update coop_members row
      await conn.execute(
        `UPDATE coop_members SET
          registration_fee = ?,
          capital_share = ?,
          initial_savings = ?,
          total_paid = ?,
          membership_type = ?,
          payment_method = ?,
          payment_reference = ?
         WHERE member_no = ?`,
        [newFee, newCap, newSav, newTotal, targetMembershipType, payMethod, payRef, m.member_no as string]
      );

      await conn.commit();

      const updatedMember: CooperativeMember = {
        id: m.id as number | string,
        memberNo: m.member_no as string,
        linkedUserId: (m.linked_user_id as number) || null,
        membershipType: targetMembershipType,
        firstName: m.first_name as string,
        middleName: (m.middle_name as string) || undefined,
        lastName: m.last_name as string,
        suffix: (m.suffix as string) || undefined,
        fullName: m.full_name as string,
        gender: (m.gender as CooperativeMember['gender']) || null,
        dateOfBirth: m.date_of_birth ? new Date(m.date_of_birth as string).toISOString().slice(0, 10) : null,
        civilStatus: (m.civil_status as CooperativeMember['civilStatus']) || null,
        email: m.email as string,
        contactNumber: (m.contact_number as string) || '',
        address: (m.address as string) || '',
        barangay: (m.barangay as string) || '',
        city: (m.city as string) || '',
        province: (m.province as string) || '',
        occupation: (m.occupation as string) || '',
        monthlyIncome: Number(m.monthly_income) || 0,
        signatureData: (m.signature_data as string) || null,
        signatureAuthId: (m.signature_auth_id as string) || null,
        signatureTimestamp: m.signature_timestamp ? new Date(m.signature_timestamp as string).toISOString() : null,
        photoUrl: (m.photo_url as string) || null,
        photoTimestamp: m.photo_timestamp ? new Date(m.photo_timestamp as string).toISOString() : null,
        idSelfieUrl: (m.id_selfie_url as string) || null,
        idSelfieTimestamp: m.id_selfie_timestamp ? new Date(m.id_selfie_timestamp as string).toISOString() : null,
        validIdType: (m.valid_id_type as string) || null,
        validIdNumber: (m.valid_id_number as string) || null,
        registrationFee: newFee,
        capitalShare: newCap,
        initialSavings: newSav,
        totalPaid: newTotal,
        paymentMethod: payMethod,
        paymentReference: payRef,
        registeredById: (m.registered_by_id as number) || undefined,
        registeredByName: (m.registered_by_name as string) || 'Cooperative Officer',
        registeredByRole: (m.registered_by_role as CooperativeMember['registeredByRole']) || 'account_officer',
        registrationStatus: (m.registration_status as CooperativeMember['registrationStatus']) || 'active',
        createdAt: m.created_at ? new Date(m.created_at as string).toISOString() : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      return {
        member: updatedMember,
        remainingBalances: {
          registrationFee: Math.max(0, MEMBER_FEES.REGISTRATION_FEE - newFee),
          capitalShare: Math.max(0, MEMBER_FEES.CAPITAL_SHARE - newCap),
          initialSavings: Math.max(0, MEMBER_FEES.INITIAL_SAVINGS - newSav),
          totalRemaining: Math.max(0, MEMBER_FEES.TOTAL_PAYMENT - newTotal),
        },
        audit: {
          recordedById: actorId,
          recordedByName: actorName,
          recordedByRole: actorRole,
          auditId,
          paymentReference: payRef,
          paymentMethod: payMethod,
          isReplay: false,
        },
      };
    } catch (err: unknown) {
      if (conn) {
        try {
          await conn.rollback();
        } catch {}
      }
      const msg = err instanceof Error ? err.message : String(err);
      throw new DatabasePersistenceError(`Failed to record membership payment: ${msg}`);
    } finally {
      if (conn) conn.release();
    }
  }

  // In-Memory Fallback with Idempotency Protection
  const members = await listCooperativeMembers();
  const member = members.find((m) => m.memberNo === input.memberNo);
  if (!member) {
    throw new Error(`Cooperative member "${input.memberNo}" not found.`);
  }

  globalThis.__tributeCoopMemberTransactions = globalThis.__tributeCoopMemberTransactions || [];
  const existingTxns = globalThis.__tributeCoopMemberTransactions.filter(
    (t) => t.memberNo === input.memberNo && t.paymentReference === payRef
  );
  if (existingTxns.length > 0) {
    const origTotalAmount = existingTxns.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
    const origMethod = existingTxns[0].paymentMethod || 'cash';
    const origComponent =
      existingTxns[0].requestComponent ||
      (existingTxns.length > 1 ? 'all' : existingTxns[0].transactionType);
    const origAuditId = existingTxns[0].auditId || '';
    const origActorId = existingTxns[0].recordedById || null;
    const origActorName = existingTxns[0].recordedByName || 'Cooperative Officer';
    const origActorRole = existingTxns[0].recordedByRole || 'account_officer';

    if (
      Math.abs(origTotalAmount - input.amount) > 0.009 ||
      input.component !== origComponent ||
      (input.paymentMethod && input.paymentMethod !== origMethod)
    ) {
      throw new PaymentConflictError(
        `Payment reference "${payRef}" was already recorded for member ${input.memberNo} with a different payload (Original: ${origComponent}, ₱${origTotalAmount} via ${origMethod}; Attempted: ${input.component}, ₱${input.amount} via ${payMethod}).`
      );
    }

    return {
      member,
      remainingBalances: {
        registrationFee: Math.max(0, MEMBER_FEES.REGISTRATION_FEE - (member.registrationFee || 0)),
        capitalShare: Math.max(0, MEMBER_FEES.CAPITAL_SHARE - (member.capitalShare || 0)),
        initialSavings: Math.max(0, MEMBER_FEES.INITIAL_SAVINGS - (member.initialSavings || 0)),
        totalRemaining: Math.max(0, MEMBER_FEES.TOTAL_PAYMENT - (member.totalPaid || 0)),
      },
      audit: {
        recordedById: origActorId,
        recordedByName: origActorName,
        recordedByRole: origActorRole,
        auditId: origAuditId,
        paymentReference: payRef,
        paymentMethod: origMethod,
        isReplay: true,
      },
    };
  }

  const curFee = member.registrationFee || 0;
  const curCap = member.capitalShare || 0;
  const curSav = member.initialSavings || 0;

  const remFee = Math.max(0, MEMBER_FEES.REGISTRATION_FEE - curFee);
  const remCap = Math.max(0, MEMBER_FEES.CAPITAL_SHARE - curCap);
  const remSav = Math.max(0, MEMBER_FEES.INITIAL_SAVINGS - curSav);

  let allocFee = 0;
  let allocCap = 0;
  let allocSav = 0;

  if (input.component === 'registration_fee') {
    if (remFee <= 0) throw new Error('Registration Fee is already fully paid (₱500.00).');
    if (input.amount > remFee) throw new Error(`Amount ₱${input.amount} exceeds remaining fee balance of ₱${remFee}.`);
    allocFee = input.amount;
  } else if (input.component === 'capital_share') {
    if (remCap <= 0) throw new Error('Capital Share is already fully paid (₱2,000.00).');
    if (input.amount > remCap) throw new Error(`Amount ₱${input.amount} exceeds remaining capital share balance of ₱${remCap}.`);
    allocCap = input.amount;
  } else if (input.component === 'savings_deposit') {
    if (remSav <= 0) throw new Error('Initial Savings is already fully paid (₱500.00).');
    if (input.amount > remSav) throw new Error(`Amount ₱${input.amount} exceeds remaining savings deposit balance of ₱${remSav}.`);
    allocSav = input.amount;
  } else if (input.component === 'all') {
    const totalRemaining = remFee + remCap + remSav;
    if (totalRemaining <= 0) throw new Error('All required membership components are already fully paid.');
    if (input.amount > totalRemaining) {
      throw new Error(`Amount ₱${input.amount} exceeds total remaining required balance of ₱${totalRemaining}.`);
    }

    let left = input.amount;
    allocFee = Math.min(left, remFee);
    left -= allocFee;
    allocCap = Math.min(left, remCap);
    left -= allocCap;
    allocSav = Math.min(left, remSav);
  }

  const totalAdded = allocFee + allocCap + allocSav;
  if (totalAdded <= 0) {
    throw new Error('Payment amount must be greater than zero.');
  }

  const newFee = curFee + allocFee;
  const newCap = curCap + allocCap;
  const newSav = curSav + allocSav;
  const newTotal = newFee + newCap + newSav;
  const isPromoted = newFee >= MEMBER_FEES.REGISTRATION_FEE && newCap >= MEMBER_FEES.CAPITAL_SHARE && newSav >= MEMBER_FEES.INITIAL_SAVINGS;
  const targetMembershipType: MembershipType = isPromoted ? 'full_cooperative' : member.membershipType;

  const nowIso = new Date().toISOString();
  member.registrationFee = newFee;
  member.capitalShare = newCap;
  member.initialSavings = newSav;
  member.totalPaid = newTotal;
  member.membershipType = targetMembershipType;
  member.paymentReference = payRef;
  member.paymentMethod = payMethod;
  member.updatedAt = nowIso;

  if (allocFee > 0) {
    globalThis.__tributeCoopMemberTransactions.push({
      memberId: member.id,
      memberNo: member.memberNo,
      transactionType: 'registration_fee',
      amount: allocFee,
      referenceNo: `FEE-${payRef}`,
      recordedByName: actorName,
      recordedById: actorId,
      recordedByRole: actorRole,
      auditId,
      paymentMethod: payMethod,
      paymentReference: payRef,
      requestComponent: input.component,
      createdAt: nowIso,
    });
  }
  if (allocCap > 0) {
    globalThis.__tributeCoopMemberTransactions.push({
      memberId: member.id,
      memberNo: member.memberNo,
      transactionType: 'capital_share',
      amount: allocCap,
      referenceNo: `CS-${payRef}`,
      recordedByName: actorName,
      recordedById: actorId,
      recordedByRole: actorRole,
      auditId,
      paymentMethod: payMethod,
      paymentReference: payRef,
      requestComponent: input.component,
      createdAt: nowIso,
    });
  }
  if (allocSav > 0) {
    globalThis.__tributeCoopMemberTransactions.push({
      memberId: member.id,
      memberNo: member.memberNo,
      transactionType: 'savings_deposit',
      amount: allocSav,
      referenceNo: `SAV-${payRef}`,
      recordedByName: actorName,
      recordedById: actorId,
      recordedByRole: actorRole,
      auditId,
      paymentMethod: payMethod,
      paymentReference: payRef,
      requestComponent: input.component,
      createdAt: nowIso,
    });
  }

  return {
    member,
    remainingBalances: {
      registrationFee: Math.max(0, MEMBER_FEES.REGISTRATION_FEE - newFee),
      capitalShare: Math.max(0, MEMBER_FEES.CAPITAL_SHARE - newCap),
      initialSavings: Math.max(0, MEMBER_FEES.INITIAL_SAVINGS - newSav),
      totalRemaining: Math.max(0, MEMBER_FEES.TOTAL_PAYMENT - newTotal),
    },
    audit: {
      recordedById: actorId,
      recordedByName: actorName,
      recordedByRole: actorRole,
      auditId,
      paymentReference: payRef,
      paymentMethod: payMethod,
      isReplay: false,
    },
  };
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
  const paymentReference = input.paymentReference?.trim() || `REC-${Date.now().toString().slice(-6)}`;
  const registrationAuditId = `AUD-MEMBER-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

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
           (member_no, linked_user_id, membership_type, first_name, middle_name, last_name, suffix, full_name, gender, date_of_birth, civil_status,
            email, contact_number, address, barangay, city, province, occupation, monthly_income,
            signature_data, signature_auth_id, signature_timestamp, photo_url, photo_timestamp,
            id_selfie_url, id_selfie_timestamp, valid_id_type, valid_id_number,
            registration_fee, capital_share, initial_savings, total_paid, payment_method, payment_reference,
            registered_by_id, registered_by_name, registered_by_role, registration_status)
           VALUES (?, NULL, 'full_cooperative', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
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
            paymentReference,
            input.registeredById || null,
            input.registeredByName || 'Cooperative Registrar',
            input.registeredByRole || 'account_officer',
          ]
        )) as unknown as [{ insertId: number }];

        const newId = insertRes.insertId;
        const payRef = paymentReference;
        const regName = input.registeredByName || 'Cooperative Registrar';
        const regId = input.registeredById || null;
        const regRole = input.registeredByRole || 'account_officer';
        const method = input.paymentMethod || 'cash';

        // 3. Insert all three ledger entries in same atomic transaction
        await conn.execute(
          `INSERT INTO coop_member_transactions
           (member_id, member_no, transaction_type, amount, reference_no, recorded_by_name, recorded_by_id, recorded_by_role, audit_id, payment_method, payment_reference, request_component)
           VALUES
           (?, ?, 'registration_fee', 500.00, ?, ?, ?, ?, ?, ?, ?, 'all'),
           (?, ?, 'capital_share', 2000.00, ?, ?, ?, ?, ?, ?, ?, 'all'),
           (?, ?, 'savings_deposit', 500.00, ?, ?, ?, ?, ?, ?, ?, 'all')`,
          [
            newId, memberNo, `FEE-${payRef}`, regName, regId, regRole, registrationAuditId, method, payRef,
            newId, memberNo, `CS-${payRef}`, regName, regId, regRole, registrationAuditId, method, payRef,
            newId, memberNo, `SAV-${payRef}`, regName, regId, regRole, registrationAuditId, method, payRef,
          ]
        );

        // Commit transaction atomically
        await conn.commit();

        const createdMember: CooperativeMember = {
          id: newId,
          memberNo,
          linkedUserId: null,
          membershipType: 'full_cooperative',
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
    membershipType: 'full_cooperative',
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
    paymentReference,
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
      recordedById: newMember.registeredById,
      recordedByRole: newMember.registeredByRole,
      auditId: registrationAuditId,
      paymentMethod: newMember.paymentMethod,
      paymentReference,
      requestComponent: 'all',
      createdAt: nowIso,
    },
    {
      memberId: newMember.id,
      memberNo: newMember.memberNo,
      transactionType: 'capital_share',
      amount: MEMBER_FEES.CAPITAL_SHARE,
      referenceNo: `CS-${newMember.paymentReference}`,
      recordedByName: newMember.registeredByName,
      recordedById: newMember.registeredById,
      recordedByRole: newMember.registeredByRole,
      auditId: registrationAuditId,
      paymentMethod: newMember.paymentMethod,
      paymentReference,
      requestComponent: 'all',
      createdAt: nowIso,
    },
    {
      memberId: newMember.id,
      memberNo: newMember.memberNo,
      transactionType: 'savings_deposit',
      amount: MEMBER_FEES.INITIAL_SAVINGS,
      referenceNo: `SAV-${newMember.paymentReference}`,
      recordedByName: newMember.registeredByName,
      recordedById: newMember.registeredById,
      recordedByRole: newMember.registeredByRole,
      auditId: registrationAuditId,
      paymentMethod: newMember.paymentMethod,
      paymentReference,
      requestComponent: 'all',
      createdAt: nowIso,
    }
  );
  globalThis.__tributeCoopMemberTransactions = txList;

  return newMember;
}

// Reconciliation / Backfill: ensures every existing borrower has a corresponding coop_members row
// Prioritizes authoritative application fullProfile data over raw users fallback
export async function reconcileBorrowerMemberships(options?: {
  recordedByName?: string;
  recordedByRole?: 'admin' | 'account_officer';
  recordedById?: number | null;
}): Promise<{
  totalEvaluated: number;
  newlyCreated: number;
  alreadyExisted: number;
  errors: string[];
}> {
  let totalEvaluated = 0;
  let newlyCreated = 0;
  let alreadyExisted = 0;
  const errors: string[] = [];

  const actorName = options?.recordedByName || 'System Reconciliation';
  const actorRole = options?.recordedByRole || 'admin';
  const actorId = options?.recordedById || null;

  if (isDatabaseConfigured()) {
    try {
      const db = await import('./db');
      const users = await db.query<Record<string, unknown>[]>(
        "SELECT id, name, email, contact_number, address FROM users WHERE role = 'borrower'"
      );

      if (users && users.length > 0) {
        totalEvaluated = users.length;
        for (const u of users) {
          try {
            const userId = u.id as number;
            const email = (u.email as string)?.trim().toLowerCase();
            const name = (u.name as string)?.trim() || 'Borrower Member';
            const contact = (u.contact_number as string)?.trim() || '';
            const address = (u.address as string)?.trim() || '';

            // Check if coop_members row exists by user link or email
            const existingRows = await db.query<Record<string, unknown>[]>(
              'SELECT id FROM coop_members WHERE linked_user_id = ? OR email = ? LIMIT 1',
              [userId, email]
            );

            if (existingRows && existingRows.length > 0) {
              alreadyExisted++;
            } else {
              // Search in-memory and database loan applications for authoritative fullProfile
              let authProfile: Record<string, Record<string, string | number | undefined>> | null = null;
              if (global.__tributeAssessmentsStore && Array.isArray(global.__tributeAssessmentsStore)) {
                const match = global.__tributeAssessmentsStore.find(
                  (a) => a.borrowerEmail?.toLowerCase() === email || a.borrowerName.toLowerCase() === name.toLowerCase()
                );
                if (match && match.fullProfile) {
                  authProfile = match.fullProfile as Record<string, Record<string, string | number | undefined>>;
                }
              }

              const step1 = authProfile?.step1 || {};
              const step2 = authProfile?.step2 || {};
              const govIds = (authProfile?.govIds as unknown as Array<{ idType?: string; idNumber?: string }>) || [];
              const primaryGovId = Array.isArray(govIds) && govIds.length > 0 ? govIds[0] : null;

              await createProvisionalBorrowerMember({
                linkedUserId: userId,
                name: (step1.firstName && step1.lastName ? `${step1.firstName} ${step1.lastName}` : name),
                email,
                contactNumber: contact || String(step2.mobileNumber || ''),
                address: address || String(step2.addressLine1 || ''),
                firstName: typeof step1.firstName === 'string' ? step1.firstName : undefined,
                middleName: typeof step1.middleName === 'string' ? step1.middleName : undefined,
                lastName: typeof step1.lastName === 'string' ? step1.lastName : undefined,
                suffix: typeof step1.suffix === 'string' ? step1.suffix : undefined,
                gender: step1.sex === 'Female' ? 'Female' : step1.sex === 'Male' ? 'Male' : null,
                dateOfBirth: typeof step1.dateOfBirth === 'string' ? step1.dateOfBirth : null,
                civilStatus: (step1.civilStatus as CooperativeMember['civilStatus']) || null,
                barangay: typeof step2.barangay === 'string' ? step2.barangay : '',
                city: typeof step2.city === 'string' ? step2.city : '',
                province: typeof step2.province === 'string' ? step2.province : '',
                occupation: typeof authProfile?.step4?.occupation === 'string' ? authProfile.step4.occupation : '',
                monthlyIncome: Number(authProfile?.step4?.monthlyNetIncome) || 0,
                validIdType: primaryGovId?.idType || null,
                validIdNumber: primaryGovId?.idNumber || null,
                signatureAuthId: typeof step1.signatureAuthId === 'string' ? step1.signatureAuthId : null,
                recordedById: actorId,
                recordedByName: actorName,
                recordedByRole: actorRole,
              });
              newlyCreated++;
            }
          } catch (e: unknown) {
            const errStr = e instanceof Error ? e.message : String(e);
            errors.push(`User ${u.id}: ${errStr}`);
          }
        }
      }
      return { totalEvaluated, newlyCreated, alreadyExisted, errors };
    } catch (e: unknown) {
      const errStr = e instanceof Error ? e.message : String(e);
      throw new DatabasePersistenceError(`Database reconciliation failed: ${errStr}`);
    }
  }

  // Memory fallback for tests
  return { totalEvaluated: 0, newlyCreated: 0, alreadyExisted: 0, errors: [] };
}
