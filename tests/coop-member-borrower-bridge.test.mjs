import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const STORE_PATH = path.join(ROOT, 'src/lib/coop-member-store.ts');
const DETECT_API_PATH = path.join(ROOT, 'src/app/api/members/detect/route.ts');
const PAYMENTS_API_PATH = path.join(ROOT, 'src/app/api/members/payments/route.ts');
const MEMBERS_API_PATH = path.join(ROOT, 'src/app/api/members/route.ts');
const MIGRATION_PATH = path.join(ROOT, 'database/migrations/20261121_cooperative_member_borrower_bridge.sql');

function readIfExists(filePath) {
  assert.ok(fs.existsSync(filePath), `Expected file to exist: ${filePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

test('Bridge Test 1: Real-time detection finds exact matches and rejects fuzzy name matches', async () => {
  const store = await import('../src/lib/coop-member-store.ts');
  assert.equal(typeof store.findMatchingCooperativeMember, 'function');

  // Register a member to test against
  const member = await store.registerCooperativeMember({
    firstName: 'Teresa',
    lastName: 'Magbanua',
    gender: 'Female',
    dateOfBirth: '1971-11-04',
    civilStatus: 'Married',
    email: 'teresa.magbanua.bridge@example.ph',
    contactNumber: '0917-888-9999',
    address: 'Pototan',
    barangay: 'Barangay 1',
    city: 'Pototan',
    province: 'Iloilo',
    occupation: 'Teacher',
    monthlyIncome: 35000,
    validIdType: 'PRC ID',
    validIdNumber: 'PRC-09912',
    signatureData: 'data:image/png;base64,mockSig',
    photoUrl: 'data:image/jpeg;base64,mockPhoto',
    idSelfieUrl: 'data:image/jpeg;base64,mockSelfie',
    paymentMethod: 'cash',
  });

  // 1. Exact memberNo match
  const matchByNo = await store.findMatchingCooperativeMember({ memberNo: member.memberNo });
  assert.ok(matchByNo, 'Must match by exact memberNo');
  assert.equal(matchByNo.memberNo, member.memberNo);

  // 2. Exact email match (case-insensitive)
  const matchByEmail = await store.findMatchingCooperativeMember({ email: 'TERESA.magbanua.bridge@EXAMPLE.ph' });
  assert.ok(matchByEmail, 'Must match by exact normalized email');
  assert.equal(matchByEmail.memberNo, member.memberNo);

  // 3. Exact compound match: phone + dateOfBirth
  const matchCompound = await store.findMatchingCooperativeMember({
    contactNumber: '0917-888-9999',
    dateOfBirth: '1971-11-04',
  });
  assert.ok(matchCompound, 'Must match by compound phone + DOB');
  assert.equal(matchCompound.memberNo, member.memberNo);

  // 4. Missing one of compound match components -> No match
  const matchPhoneOnly = await store.findMatchingCooperativeMember({ contactNumber: '0917-888-9999' });
  assert.equal(matchPhoneOnly, null, 'Must reject phone-only match to prevent false positives');

  // 5. Zero fuzzy name matching
  const matchFuzzyName = await store.findMatchingCooperativeMember({
    // name only, no email, no memberNo, no compound
    firstName: 'Teresa',
    lastName: 'Magbanua',
  });
  assert.equal(matchFuzzyName, null, 'Fuzzy name match must return null');
});

test('Bridge Test 2: Automatic provisional borrower-only creation does not duplicate or pollute full members', async () => {
  const store = await import('../src/lib/coop-member-store.ts');
  assert.equal(typeof store.createProvisionalBorrowerMember, 'function');

  const provisional = await store.createProvisionalBorrowerMember({
    linkedUserId: 9901,
    name: 'Juanito Pelaez',
    email: 'juanito.pelaez.prov@example.ph',
    contactNumber: '0920-555-1234',
    address: 'Binondo, Manila',
    dateOfBirth: '1995-08-20',
    recordedByName: 'Officer Juan',
    recordedByRole: 'account_officer',
  });

  assert.equal(provisional.membershipType, 'borrower_only');
  assert.equal(provisional.totalPaid, 0);
  assert.equal(provisional.registrationFee, 0);
  assert.equal(provisional.capitalShare, 0);
  assert.equal(provisional.initialSavings, 0);
  assert.equal(provisional.linkedUserId, 9901);

  // Re-calling with same user ID or email returns the existing record without creating duplicate
  const reCall = await store.createProvisionalBorrowerMember({
    linkedUserId: 9901,
    name: 'Juanito Pelaez',
    email: 'juanito.pelaez.prov@example.ph',
    contactNumber: '0920-555-1234',
    address: 'Binondo, Manila',
    dateOfBirth: '1995-08-20',
  });

  assert.equal(reCall.memberNo, provisional.memberNo, 'Must be idempotent and not create duplicate');
});

test('Bridge Test 3: Incremental payment recording and automatic promotion upon ₱3,000 threshold', async () => {
  const store = await import('../src/lib/coop-member-store.ts');
  assert.equal(typeof store.recordMembershipPayment, 'function');

  // Create provisional borrower member
  const prov = await store.createProvisionalBorrowerMember({
    linkedUserId: 9902,
    name: 'Gliceria Marella',
    email: 'gliceria.marella.pay@example.ph',
    contactNumber: '0919-444-5555',
    address: 'Taal, Batangas',
  });

  assert.equal(prov.membershipType, 'borrower_only');

  // Step 1: Record ₱500 Registration Fee
  const pay1 = await store.recordMembershipPayment({
    memberNo: prov.memberNo,
    component: 'registration_fee',
    amount: 500,
    paymentMethod: 'cash',
    paymentReference: 'OR-FEE-001',
    recordedByName: 'Officer Juan',
    recordedByRole: 'account_officer',
  });

  assert.equal(pay1.member.registrationFee, 500);
  assert.equal(pay1.member.totalPaid, 500);
  assert.equal(pay1.member.membershipType, 'borrower_only', 'Still borrower_only because capital and savings are unpaid');
  assert.equal(pay1.remainingBalances.registrationFee, 0);
  assert.equal(pay1.remainingBalances.capitalShare, 2000);
  assert.equal(pay1.remainingBalances.initialSavings, 500);
  assert.equal(pay1.remainingBalances.totalRemaining, 2500);

  // Step 2: Attempting to pay registration fee again when already 0 remaining
  await assert.rejects(
    async () => {
      await store.recordMembershipPayment({
        memberNo: prov.memberNo,
        component: 'registration_fee',
        amount: 500,
        paymentMethod: 'cash',
        paymentReference: 'OR-FEE-DUP',
        recordedByName: 'Officer Juan',
        recordedByRole: 'account_officer',
      });
    },
    /already fully paid|exceeds/i
  );

  // Step 3: Pay remaining ₱2,500 (Capital Share ₱2,000 + Initial Savings ₱500)
  const pay2 = await store.recordMembershipPayment({
    memberNo: prov.memberNo,
    component: 'all',
    amount: 2500,
    paymentMethod: 'cash',
    paymentReference: 'OR-FULL-002',
    recordedByName: 'Officer Juan',
    recordedByRole: 'account_officer',
  });

  assert.equal(pay2.member.registrationFee, 500);
  assert.equal(pay2.member.capitalShare, 2000);
  assert.equal(pay2.member.initialSavings, 500);
  assert.equal(pay2.member.totalPaid, 3000);
  assert.equal(pay2.remainingBalances.totalRemaining, 0);
  assert.equal(pay2.member.membershipType, 'full_cooperative', 'Must promote to full_cooperative once ₱3,000 is satisfied');
});

test('Bridge Test 4: Dual-tab listing distinguishes Cooperative Members from Borrower-Only Members', async () => {
  const store = await import('../src/lib/coop-member-store.ts');

  const fullMembers = await store.listCooperativeMembers('', 'full_cooperative');
  const borrowerOnly = await store.listCooperativeMembers('', 'borrower_only');

  for (const m of fullMembers) {
    assert.equal(m.membershipType, 'full_cooperative');
  }
  for (const m of borrowerOnly) {
    assert.equal(m.membershipType, 'borrower_only');
  }
});

test('Bridge Test 5: API routes exist, check auth, and handle detect and payment calls', () => {
  assert.ok(fs.existsSync(DETECT_API_PATH), 'Detect API route must exist');
  assert.ok(fs.existsSync(PAYMENTS_API_PATH), 'Payments API route must exist');

  const detectSrc = readIfExists(DETECT_API_PATH);
  assert.ok(detectSrc.includes('requireApiRole'), 'Detect API must check auth');
  assert.ok(detectSrc.includes('account_officer') && detectSrc.includes('admin'), 'Must allow AO and Admin');

  const paySrc = readIfExists(PAYMENTS_API_PATH);
  assert.ok(paySrc.includes('requireApiRole'), 'Payments API must check auth');
  assert.ok(paySrc.includes('recordMembershipPayment'), 'Must call payment recording logic');
});

test('Bridge Test 6: Hostinger idempotent migration file exists and is safe', () => {
  const migSrc = readIfExists(MIGRATION_PATH);
  assert.ok(!migSrc.match(/CREATE\s+DATABASE/i), 'Must not create database');
  assert.ok(!migSrc.match(/USE\s+`?tribute_coop_db`?/i), 'Must not use hardcoded database');
  assert.ok(migSrc.includes('membership_type'), 'Must alter membership_type');
});
