async function safeQuery<T>(sql: string, params: unknown[] = []): Promise<T | null> {
  try {
    const db = await import('./db');
    return await db.query<T>(sql, params);
  } catch {
    return null;
  }
}

export const MEMBER_FEES = {
  REGISTRATION_FEE: 500,
  CAPITAL_SHARE: 2000,
  INITIAL_SAVINGS: 500,
  TOTAL_PAYMENT: 3000,
} as const;

export interface CooperativeMember {
  id: number | string;
  memberNo: string; // e.g. TCID-M-2026-0001
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

export interface MemberTransactionRecord {
  id?: number | string;
  memberId: number | string;
  memberNo: string;
  transactionType: 'registration_fee' | 'capital_share' | 'savings_deposit';
  amount: number;
  referenceNo: string;
  recordedByName: string;
  createdAt: string;
}

declare global {
  var __tributeCoopMembersStore: CooperativeMember[] | undefined;
  var __tributeCoopMemberTransactions: MemberTransactionRecord[] | undefined;
}

if (!globalThis.__tributeCoopMembersStore) {
  globalThis.__tributeCoopMembersStore = [];
}
if (!globalThis.__tributeCoopMemberTransactions) {
  globalThis.__tributeCoopMemberTransactions = [];
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

  validIdType: string;
  validIdNumber: string;

  // Mandatory 3 Evidence Items
  signatureData: string;
  photoUrl: string;
  idSelfieUrl: string;

  paymentMethod: 'cash' | 'online' | 'bank_transfer';
  paymentReference?: string;

  registeredById?: number;
  registeredByName: string;
  registeredByRole: 'admin' | 'account_officer';
}

function generateMemberNo(): string {
  const year = new Date().getFullYear();
  const count = (globalThis.__tributeCoopMembersStore?.length || 0) + 1;
  const seq = String(count).padStart(4, '0');
  const randomSuffix = Math.floor(100 + Math.random() * 900);
  return `TCID-M-${year}-${seq}-${randomSuffix}`;
}

export async function listCooperativeMembers(searchQuery = ''): Promise<CooperativeMember[]> {
  const memoryMembers = globalThis.__tributeCoopMembersStore || [];
  let dbMembers: CooperativeMember[] = [];

  try {
    const rows = await safeQuery<Record<string, unknown>[]>(
      `SELECT * FROM coop_members ORDER BY id DESC`
    );
    if (rows && rows.length > 0) {
      dbMembers = rows.map((r) => ({
        id: r.id as number | string,
        memberNo: r.member_no as string,
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
    }
  } catch {
    // MySQL unavailable; fallback to memory store
  }

  // Merge unique by memberNo
  const combinedMap = new Map<string, CooperativeMember>();
  for (const m of memoryMembers) combinedMap.set(m.memberNo, m);
  for (const m of dbMembers) combinedMap.set(m.memberNo, m);

  let result = Array.from(combinedMap.values());

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

  return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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

  // Duplicate Check: Email must be unique across members
  const existingList = await listCooperativeMembers();
  const normalizedEmail = input.email.toLowerCase().trim();
  const duplicate = existingList.find((m) => m.email.toLowerCase().trim() === normalizedEmail);
  if (duplicate) {
    throw new Error(`A cooperative member with email "${input.email}" already exists (Member No: ${duplicate.memberNo}).`);
  }

  const nowIso = new Date().toISOString();
  const memberNo = generateMemberNo();
  const signatureAuthId = `AUTH-SIG-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const fullName = [input.firstName, input.middleName, input.lastName, input.suffix]
    .filter(Boolean)
    .join(' ')
    .trim();

  const newMember: CooperativeMember = {
    id: memberNo,
    memberNo,
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

    // Evidence
    signatureData: input.signatureData,
    signatureAuthId,
    signatureTimestamp: nowIso,
    photoUrl: input.photoUrl,
    photoTimestamp: nowIso,
    idSelfieUrl: input.idSelfieUrl,
    idSelfieTimestamp: nowIso,
    validIdType: input.validIdType.trim(),
    validIdNumber: input.validIdNumber.trim(),

    // Fixed Opening Amounts
    registrationFee: MEMBER_FEES.REGISTRATION_FEE,
    capitalShare: MEMBER_FEES.CAPITAL_SHARE,
    initialSavings: MEMBER_FEES.INITIAL_SAVINGS,
    totalPaid: MEMBER_FEES.TOTAL_PAYMENT,
    paymentMethod: input.paymentMethod || 'cash',
    paymentReference: input.paymentReference?.trim() || `REC-${Date.now().toString().slice(-6)}`,

    // Audit Info
    registeredById: input.registeredById,
    registeredByName: input.registeredByName || 'Cooperative Registrar',
    registeredByRole: input.registeredByRole || 'account_officer',
    registrationStatus: 'active',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  // Persist into memory store
  globalThis.__tributeCoopMembersStore = globalThis.__tributeCoopMembersStore || [];
  globalThis.__tributeCoopMembersStore.unshift(newMember);

  // Record 3 distinct financial transactions
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

  // Persist into MySQL if available
  try {
    const insertRes = await safeQuery<{ insertId?: number }>(
      `INSERT INTO coop_members 
       (member_no, first_name, middle_name, last_name, suffix, full_name, gender, date_of_birth, civil_status,
        email, contact_number, address, barangay, city, province, occupation, monthly_income,
        signature_data, signature_auth_id, signature_timestamp, photo_url, photo_timestamp,
        id_selfie_url, id_selfie_timestamp, valid_id_type, valid_id_number,
        registration_fee, capital_share, initial_savings, total_paid, payment_method, payment_reference,
        registered_by_id, registered_by_name, registered_by_role, registration_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newMember.memberNo,
        newMember.firstName,
        newMember.middleName || null,
        newMember.lastName,
        newMember.suffix || null,
        newMember.fullName,
        newMember.gender,
        newMember.dateOfBirth,
        newMember.civilStatus,
        newMember.email,
        newMember.contactNumber,
        newMember.address,
        newMember.barangay,
        newMember.city,
        newMember.province,
        newMember.occupation,
        newMember.monthlyIncome,
        newMember.signatureData,
        newMember.signatureAuthId,
        new Date(newMember.signatureTimestamp),
        newMember.photoUrl,
        new Date(newMember.photoTimestamp),
        newMember.idSelfieUrl,
        new Date(newMember.idSelfieTimestamp),
        newMember.validIdType,
        newMember.validIdNumber,
        newMember.registrationFee,
        newMember.capitalShare,
        newMember.initialSavings,
        newMember.totalPaid,
        newMember.paymentMethod,
        newMember.paymentReference || null,
        newMember.registeredById || null,
        newMember.registeredByName,
        newMember.registeredByRole,
        newMember.registrationStatus,
      ]
    );

    if (insertRes && insertRes.insertId) {
      newMember.id = insertRes.insertId;
      await safeQuery(
        `INSERT INTO coop_member_transactions (member_id, member_no, transaction_type, amount, reference_no, recorded_by_name)
         VALUES 
         (?, ?, 'registration_fee', 500.00, ?, ?),
         (?, ?, 'capital_share', 2000.00, ?, ?),
         (?, ?, 'savings_deposit', 500.00, ?, ?)`,
        [
          insertRes.insertId,
          newMember.memberNo,
          `FEE-${newMember.paymentReference}`,
          newMember.registeredByName,
          insertRes.insertId,
          newMember.memberNo,
          `CS-${newMember.paymentReference}`,
          newMember.registeredByName,
          insertRes.insertId,
          newMember.memberNo,
          `SAV-${newMember.paymentReference}`,
          newMember.registeredByName,
        ]
      );
    }
  } catch {
    // MySQL not reachable; in-memory store serves as source of truth
  }

  // NOTE: STRICTLY MEMBERSHIP ONLY. No loan applications or credit assessments created!
  return newMember;
}
