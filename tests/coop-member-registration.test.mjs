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
const MIGRATION_PATH = path.join(ROOT, 'database/migrations/20261120_cooperative_members.sql');

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

  // Missing id selfie
  await assert.rejects(
    async () => {
      await store.registerCooperativeMember({ ...baseInput, idSelfieUrl: '' });
    },
    /selfie/i
  );
});

test('Coop Member Test 3: Membership registration does NOT create a loan application or credit assessment', async () => {
  const store = await import('../src/lib/coop-member-store.ts');

  const beforeAssessments = Array.isArray(globalThis.__tributeAssessmentsStore)
    ? globalThis.__tributeAssessmentsStore.length
    : 0;

  const member = await store.registerCooperativeMember({
    firstName: 'Emilio',
    lastName: 'Aguinaldo',
    gender: 'Male',
    dateOfBirth: '1985-03-22',
    civilStatus: 'Married',
    email: 'emilio.aguinaldo.memonly@example.ph',
    contactNumber: '0917-999-0001',
    address: 'Kawit',
    barangay: 'Binakayan',
    city: 'Kawit',
    province: 'Cavite',
    occupation: 'Farmer',
    monthlyIncome: 35000,
    validIdType: 'PhilSys ID',
    validIdNumber: '1234-5678-9012-3456',
    signatureData: 'data:image/png;base64,mockSig',
    photoUrl: 'data:image/jpeg;base64,mockPhoto',
    idSelfieUrl: 'data:image/jpeg;base64,mockSelfie',
    paymentMethod: 'cash',
    registeredByName: 'Executive Admin',
    registeredByRole: 'admin',
  });

  assert.ok(member.memberNo.startsWith('TCID-M-'));
  assert.equal(member.totalPaid, 3000);
  assert.equal(member.registrationFee, 500);
  assert.equal(member.capitalShare, 2000);
  assert.equal(member.initialSavings, 500);

  const afterAssessments = Array.isArray(globalThis.__tributeAssessmentsStore)
    ? globalThis.__tributeAssessmentsStore.length
    : 0;

  assert.equal(
    afterAssessments,
    beforeAssessments,
    'Membership registration MUST NOT contaminate credit assessment or loan pipeline'
  );
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

  // Duplicate submission should reject with DuplicateMemberError or message
  await assert.rejects(
    async () => {
      await store.registerCooperativeMember(input);
    },
    /already exists/i
  );
});

test('Coop Member Test 5: Server-side evidence validation rejects invalid MIME and oversized payloads', async () => {
  const store = await import('../src/lib/coop-member-store.ts');
  assert.equal(typeof store.validateEvidenceDataUrl, 'function');

  // Valid PNG
  assert.doesNotThrow(() => {
    store.validateEvidenceDataUrl('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'Test Signature');
  });

  // Valid JPEG
  assert.doesNotThrow(() => {
    store.validateEvidenceDataUrl('data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/', 'Test Photo');
  });

  // Invalid MIME: PDF rejected
  assert.throws(
    () => {
      store.validateEvidenceDataUrl('data:application/pdf;base64,JVBERi0xLjQK...', 'Test Document');
    },
    /unsupported MIME type/i
  );

  // Invalid format: Plain text / malformed
  assert.throws(
    () => {
      store.validateEvidenceDataUrl('not-a-valid-data-url', 'Test Evidence');
    },
    /valid base64 image data URL/i
  );

  // Oversized: > 5MB payload rejected
  const largeBase64 = 'A'.repeat(7 * 1024 * 1024); // ~5.25 MB decoded
  assert.throws(
    () => {
      store.validateEvidenceDataUrl(`data:image/png;base64,${largeBase64}`, 'Test Large');
    },
    /exceeds the maximum allowed file size/i
  );
});

test('Coop Member Test 6: API route status code discrimination and role authorization', () => {
  const apiSrc = readIfExists(API_PATH);
  assert.ok(apiSrc.includes('requireApiRole') || apiSrc.includes('account_officer'), 'API must verify role authorization');
  assert.ok(apiSrc.includes('status: 409'), 'API must return 409 on DuplicateMemberError');
  assert.ok(apiSrc.includes('status: 500'), 'API must return 500 on DatabasePersistenceError');
  assert.ok(apiSrc.includes('status: 400'), 'API must return 400 on validation error');
});

test('Coop Member Test 7: Future borrower linkage allows connecting member to user without duplicate member records', async () => {
  const store = await import('../src/lib/coop-member-store.ts');

  const member = await store.registerCooperativeMember({
    firstName: 'Apolinario',
    lastName: 'Mabini',
    gender: 'Male',
    dateOfBirth: '1984-07-23',
    civilStatus: 'Single',
    email: 'apolinario.mabini.future@example.ph',
    contactNumber: '0917-555-4321',
    address: 'Talaga',
    barangay: 'Talaga',
    city: 'Tanauan',
    province: 'Batangas',
    occupation: 'Lawyer',
    monthlyIncome: 60000,
    validIdType: 'PRC ID',
    validIdNumber: '0098765',
    signatureData: 'data:image/png;base64,sigMabini',
    photoUrl: 'data:image/jpeg;base64,photoMabini',
    idSelfieUrl: 'data:image/jpeg;base64,selfieMabini',
    paymentMethod: 'bank_transfer',
    registeredByName: 'Officer Juan',
    registeredByRole: 'account_officer',
  });

  assert.equal(member.linkedUserId, null, 'Newly registered member must start with null linkedUserId');

  // Link member to user ID 501
  const linkRes = await store.linkMemberToUserAccount(member.memberNo, 501);
  assert.equal(linkRes.success, true);
  assert.equal(linkRes.member.linkedUserId, 501);

  // Attempting to link the same user again or member again must reject with conflict
  await assert.rejects(
    async () => {
      await store.linkMemberToUserAccount(member.memberNo, 502);
    },
    /already linked/i
  );
});

test('Coop Member Test 8: Hostinger migration syntax check (no hardcoded USE or CREATE DATABASE)', () => {
  const migrationSrc = readIfExists(MIGRATION_PATH);
  assert.ok(!migrationSrc.match(/CREATE\s+DATABASE/i), 'Migration must not contain CREATE DATABASE');
  assert.ok(!migrationSrc.match(/USE\s+`?tribute_coop_db`?/i), 'Migration must not contain hardcoded USE tribute_coop_db');
  assert.ok(migrationSrc.includes('CREATE TABLE IF NOT EXISTS `coop_members`'), 'Must create coop_members');
  assert.ok(migrationSrc.includes('`linked_user_id`'), 'Must define linked_user_id');
});

test('Coop Member Test 9: Sidebar navigation includes Cooperative Members for both AO and Admin', () => {
  const sidebarSrc = readIfExists(SIDEBAR_PATH);
  assert.ok(sidebarSrc.includes('/admin/members'), 'Sidebar must include /admin/members for Admin');
  assert.ok(sidebarSrc.includes('/officer/members'), 'Sidebar must include /officer/members for AO');
});
