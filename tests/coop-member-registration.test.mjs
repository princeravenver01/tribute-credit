import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const STORE_PATH = path.join(ROOT, 'src/lib/coop-member-store.ts');
const API_PATH = path.join(ROOT, 'src/app/api/members/route.ts');
const AO_MEMBERS_PAGE = path.join(ROOT, 'src/app/officer/members/page.tsx');
const AO_NEW_MEMBER_PAGE = path.join(ROOT, 'src/app/officer/members/new/page.tsx');
const ADMIN_MEMBERS_PAGE = path.join(ROOT, 'src/app/admin/members/page.tsx');
const ADMIN_NEW_MEMBER_PAGE = path.join(ROOT, 'src/app/admin/members/new/page.tsx');
const SIDEBAR_PATH = path.join(ROOT, 'src/components/common/Sidebar.tsx');

function readIfExists(filePath) {
  assert.ok(fs.existsSync(filePath), `Expected file to exist: ${filePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

test('Coop Member Test 1: Store enforces exact fee math (₱500 reg + ₱2000 capital + ₱500 savings = ₱3000 total)', async () => {
  assert.ok(fs.existsSync(STORE_PATH), 'src/lib/coop-member-store.ts must exist');
  const store = await import('../src/lib/coop-member-store.ts');

  assert.equal(store.MEMBER_FEES.REGISTRATION_FEE, 500);
  assert.equal(store.MEMBER_FEES.CAPITAL_SHARE, 2000);
  assert.equal(store.MEMBER_FEES.INITIAL_SAVINGS, 500);
  assert.equal(store.MEMBER_FEES.TOTAL_PAYMENT, 3000);
});

test('Coop Member Test 2: Registration rejects missing required evidence (e-signature, photo, ID selfie)', async () => {
  const store = await import('../src/lib/coop-member-store.ts');

  const baseInput = {
    firstName: 'Maria',
    lastName: 'Santos',
    gender: 'Female',
    dateOfBirth: '1990-05-15',
    civilStatus: 'Single',
    email: 'maria.santos.test@example.ph',
    contactNumber: '0917-123-4567',
    address: '123 Mahogany St',
    barangay: 'Commonwealth',
    city: 'Quezon City',
    province: 'Metro Manila',
    occupation: 'Baker',
    monthlyIncome: 25000,
    validIdType: 'UMID',
    validIdNumber: 'CRN-0111-2222-3',
    signatureData: 'data:image/png;base64,mockSignature',
    photoUrl: 'data:image/jpeg;base64,mockPhoto',
    idSelfieUrl: 'data:image/jpeg;base64,mockSelfie',
    paymentMethod: 'cash',
    registeredByName: 'Officer Juan',
    registeredByRole: 'account_officer',
  };

  // Missing signature
  await assert.rejects(
    async () => {
      await store.registerCooperativeMember({ ...baseInput, signatureData: '' });
    },
    /signature/i
  );

  // Missing photo
  await assert.rejects(
    async () => {
      await store.registerCooperativeMember({ ...baseInput, photoUrl: '' });
    },
    /photo/i
  );

  // Missing ID selfie
  await assert.rejects(
    async () => {
      await store.registerCooperativeMember({ ...baseInput, idSelfieUrl: '' });
    },
    /selfie/i
  );
});

test('Coop Member Test 3: Membership registration does NOT create a loan application or credit assessment', async () => {
  const store = await import('../src/lib/coop-member-store.ts');

  const input = {
    firstName: 'Jose',
    lastName: 'Rizal',
    gender: 'Male',
    dateOfBirth: '1985-06-19',
    civilStatus: 'Single',
    email: 'jose.rizal.membership@example.ph',
    contactNumber: '0917-987-6543',
    address: 'Calamba St',
    barangay: 'Poblacion',
    city: 'Calamba',
    province: 'Laguna',
    occupation: 'Writer',
    monthlyIncome: 45000,
    validIdType: 'Passport',
    validIdNumber: 'P1234567A',
    signatureData: 'data:image/png;base64,sig',
    photoUrl: 'data:image/jpeg;base64,photo',
    idSelfieUrl: 'data:image/jpeg;base64,selfie',
    paymentMethod: 'cash',
    registeredByName: 'Executive Admin',
    registeredByRole: 'admin',
  };

  const member = await store.registerCooperativeMember(input);
  assert.ok(member.memberNo.startsWith('TCID-M-'), 'Must generate unique cooperative MCID');
  assert.equal(member.totalPaid, 3000);

  // Verify that NO loan applications or credit assessment records were contaminated
  const globalAssessments = globalThis.__tributeAssessmentsStore || [];
  const foundLoan = globalAssessments.find((a) => a.borrowerEmail === input.email || a.borrowerName === 'Jose Rizal');
  assert.equal(foundLoan, undefined, 'Cooperative member registration must not create a loan application');
});

test('Coop Member Test 4: Duplicate prevention rejects registration with existing email', async () => {
  const store = await import('../src/lib/coop-member-store.ts');

  const input = {
    firstName: 'Andres',
    lastName: 'Bonifacio',
    gender: 'Male',
    dateOfBirth: '1988-11-30',
    civilStatus: 'Married',
    email: 'andres.bonifacio@example.ph',
    contactNumber: '0918-111-2222',
    address: 'Tondo St',
    barangay: 'Tondo',
    city: 'Manila',
    province: 'Metro Manila',
    occupation: 'Craftsman',
    monthlyIncome: 30000,
    validIdType: 'Driver License',
    validIdNumber: 'N01-12-345678',
    signatureData: 'data:image/png;base64,sig',
    photoUrl: 'data:image/jpeg;base64,photo',
    idSelfieUrl: 'data:image/jpeg;base64,selfie',
    paymentMethod: 'cash',
    registeredByName: 'Officer Juan',
    registeredByRole: 'account_officer',
  };

  await store.registerCooperativeMember(input);

  // Duplicate submission should reject
  await assert.rejects(
    async () => {
      await store.registerCooperativeMember(input);
    },
    /already exists/i
  );
});

test('Coop Member Test 5: API route enforces role authorization for AO and Admin only', () => {
  const apiSrc = readIfExists(API_PATH);
  assert.ok(apiSrc.includes('requireApiRole') || apiSrc.includes('account_officer'), 'API must verify role authorization');
  assert.ok(apiSrc.includes('admin'), 'API must allow admin role');
  assert.ok(apiSrc.includes('account_officer'), 'API must allow account_officer role');
});

test('Coop Member Test 6: Sidebar navigation includes Cooperative Members for both AO and Admin', () => {
  const sidebarSrc = readIfExists(SIDEBAR_PATH);
  assert.ok(sidebarSrc.includes('/admin/members'), 'Sidebar must include /admin/members for Admin');
  assert.ok(sidebarSrc.includes('/officer/members'), 'Sidebar must include /officer/members for AO');
});
