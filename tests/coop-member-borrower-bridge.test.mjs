import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const STORE_PATH = path.join(ROOT, 'src/lib/coop-member-store.ts');
const DETECT_API_PATH = path.join(ROOT, 'src/app/api/members/detect/route.ts');
const PAYMENTS_API_PATH = path.join(ROOT, 'src/app/api/members/payments/route.ts');
const RECONCILE_API_PATH = path.join(ROOT, 'src/app/api/members/reconcile/route.ts');
const ASSESSMENTS_API_PATH = path.join(ROOT, 'src/app/api/assessments/route.ts');
const ONBOARDING_PAGE_PATH = path.join(ROOT, 'src/app/officer/borrowers/new/page.tsx');
const OFFICER_MEMBERS_PAGE_PATH = path.join(ROOT, 'src/app/officer/members/page.tsx');
const ADMIN_MEMBERS_PAGE_PATH = path.join(ROOT, 'src/app/admin/members/page.tsx');
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
    firstName: 'Teresa',
    lastName: 'Magbanua',
  });
  assert.equal(matchFuzzyName, null, 'Fuzzy name match must return null');
});

test('Bridge Test 2: Automatic provisional borrower-only creation preserves authoritative profile and does NOT fabricate auth ID', async () => {
  const store = await import('../src/lib/coop-member-store.ts');
  assert.equal(typeof store.createProvisionalBorrowerMember, 'function');

  const provisional = await store.createProvisionalBorrowerMember({
    linkedUserId: 9901,
    name: 'Juanito Pelaez y Santos',
    firstName: 'Juanito',
    middleName: 'Pelaez',
    lastName: 'Santos',
    suffix: 'Jr.',
    email: 'juanito.pelaez.prov@example.ph',
    contactNumber: '0920-555-1234',
    address: 'Binondo, Manila',
    dateOfBirth: '1995-08-20',
    gender: 'Male',
    civilStatus: 'Single',
    barangay: 'San Nicolas',
    city: 'Manila',
    province: 'Metro Manila',
    occupation: 'Merchant',
    monthlyIncome: 45000,
    validIdType: 'UMID',
    validIdNumber: 'UMID-1234-5678',
    applicantSignature: 'data:image/png;base64,mockSignatureData',
    signatureAuthId: 'AUTH-REAL-999', // Authentic ID
    recordedByName: 'Officer Juan',
    recordedByRole: 'account_officer',
  });

  assert.equal(provisional.membershipType, 'borrower_only');
  assert.equal(provisional.firstName, 'Juanito');
  assert.equal(provisional.middleName, 'Pelaez');
  assert.equal(provisional.lastName, 'Santos');
  assert.equal(provisional.suffix, 'Jr.');
  assert.equal(provisional.signatureAuthId, 'AUTH-REAL-999', 'Must preserve real signature auth ID');

  // Test nullable handling when provisional fields and signature auth ID are absent: MUST NOT fabricate dummy values
  const minimalProv = await store.createProvisionalBorrowerMember({
    linkedUserId: 9903,
    name: 'Anonymous Borrower',
    email: 'anon.borrower@example.ph',
    contactNumber: '0999-000-1111',
    applicantSignature: 'data:image/png;base64,sigWithoutAuth',
  });

  assert.equal(minimalProv.gender, null, 'Must not fabricate Male');
  assert.equal(minimalProv.dateOfBirth, null, 'Must not fabricate 1990-01-01');
  assert.equal(minimalProv.civilStatus, null, 'Must not fabricate Single');
  assert.equal(minimalProv.validIdType, null, 'Must not fabricate System ID');
  assert.equal(minimalProv.signatureAuthId, null, 'Must NOT synthesize SIG-PROV placeholder auth ID');
});

test('Bridge Test 3: Concurrency row locking, payment idempotency retry protection, and conflict on mismatched replay', async () => {
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

  // Step 1: Record ₱500 Registration Fee with specific reference
  const pay1 = await store.recordMembershipPayment({
    memberNo: prov.memberNo,
    component: 'registration_fee',
    amount: 500,
    paymentMethod: 'cash',
    paymentReference: 'OR-FEE-001',
    recordedById: 12,
    recordedByName: 'Officer Juan',
    recordedByRole: 'account_officer',
  });

  assert.equal(pay1.member.registrationFee, 500);
  assert.equal(pay1.member.totalPaid, 500);
  assert.equal(pay1.audit.isReplay, false);
  const storedAuditId = pay1.audit.auditId;
  assert.ok(storedAuditId, 'Must generate and return auditId');

  // Step 2: Identical Replay test: submitting with the same receipt OR-FEE-001 must return existing stored auditId without double-charging
  const pay1Retry = await store.recordMembershipPayment({
    memberNo: prov.memberNo,
    component: 'registration_fee',
    amount: 500,
    paymentMethod: 'cash',
    paymentReference: 'OR-FEE-001',
    recordedById: 12,
    recordedByName: 'Officer Juan',
    recordedByRole: 'account_officer',
  });

  assert.equal(pay1Retry.member.registrationFee, 500, 'Must not double-charge registration fee on retry');
  assert.equal(pay1Retry.member.totalPaid, 500);
  assert.equal(pay1Retry.audit.isReplay, true, 'Must identify as replay');
  assert.equal(pay1Retry.audit.auditId, storedAuditId, 'Must reuse originally stored auditId');

  // Step 3: Mismatched replay test: re-using the same reference OR-FEE-001 with a different amount must throw PaymentConflictError
  await assert.rejects(
    async () => {
      await store.recordMembershipPayment({
        memberNo: prov.memberNo,
        component: 'capital_share',
        amount: 1000, // Different amount!
        paymentMethod: 'cash',
        paymentReference: 'OR-FEE-001', // Same reference!
        recordedById: 12,
        recordedByName: 'Officer Juan',
        recordedByRole: 'account_officer',
      });
    },
    (err) => {
      assert.ok(err instanceof store.PaymentConflictError, 'Must throw typed PaymentConflictError');
      assert.equal(err.statusCode, 409, 'Must map to HTTP 409');
      return true;
    }
  );

  // Step 4: Pay remaining ₱2,500 and verify promotion
  const pay2 = await store.recordMembershipPayment({
    memberNo: prov.memberNo,
    component: 'all',
    amount: 2500,
    paymentMethod: 'cash',
    paymentReference: 'OR-FULL-002',
    recordedById: 12,
    recordedByName: 'Officer Juan',
    recordedByRole: 'account_officer',
  });

  assert.equal(pay2.member.totalPaid, 3000);
  assert.equal(pay2.member.membershipType, 'full_cooperative', 'Must promote to full_cooperative once ₱3,000 is reached');
});

test('Bridge Test 4: Every-Borrower membership invariant, atomic transaction, and upsert order', () => {
  const assessSrc = readIfExists(ASSESSMENTS_API_PATH);

  // Invariant 1: No swallowed errors
  assert.ok(!assessSrc.includes("linkMemberToUserAccount(matched.memberNo, borrowerId).catch"), 'No silent swallowing of link failure');
  assert.ok(!assessSrc.includes(".catch(() => {})"), 'No empty catch blocks');

  // Invariant 2: Authoritative member lookup via mcid or cooperativeId, not policyNo
  assert.ok(assessSrc.includes('item.mcid') || assessSrc.includes('fullProfile?.step1?.cooperativeId'), 'Must resolve memberNo from mcid or cooperativeId');

  // Invariant 3: Surfacing user-member linking conflicts
  assert.ok(assessSrc.includes('already linked to another user account'), 'Must surface linking conflicts');

  // Invariant 4: One atomic transaction encompassing user, member, and loan
  assert.ok(assessSrc.includes('conn.beginTransaction()'), 'Must start single connection transaction');
  assert.ok(assessSrc.includes('conn.commit()'), 'Must commit single connection transaction');
  assert.ok(assessSrc.includes('conn.rollback()'), 'Must roll back on error');

  // Invariant 5: No phantom in-memory record before sync
  const batchIdxSync = assessSrc.indexOf('await syncToMySql(item);');
  const batchIdxUpsert = assessSrc.indexOf('upsertRecord(item);', batchIdxSync);
  assert.ok(batchIdxSync >= 0 && batchIdxUpsert > batchIdxSync, 'Batch path must syncToMySql before upsertRecord');

  const singleIdxSync = assessSrc.indexOf('await syncToMySql(body);');
  const singleIdxUpsert = assessSrc.indexOf('upsertRecord(body);', singleIdxSync);
  assert.ok(singleIdxSync >= 0 && singleIdxUpsert > singleIdxSync, 'Single path must syncToMySql before upsertRecord');
});

test('Bridge Test 5: Automatic Step 3 transition in Borrower Onboarding UI', () => {
  const pageSrc = readIfExists(ONBOARDING_PAGE_PATH);

  // Verification 1: autoAppliedMemberRef prevents duplicate loops
  assert.ok(pageSrc.includes('autoAppliedMemberRef'), 'Must use ref to track applied member and prevent re-render loops');

  // Verification 2: Automatic transition to Step 3 upon exact match
  assert.ok(pageSrc.includes('handleApplyDetectedMember(data.member)'), 'Must automatically invoke member prefill');
  assert.ok(pageSrc.includes('setCurrentStep(3)'), 'Must advance to Step 3: Dependants');
});

test('Bridge Test 6: Concurrency row locking and audit trail in migration SQL', () => {
  const migSrc = readIfExists(MIGRATION_PATH);
  assert.ok(!migSrc.match(/CREATE\s+DATABASE/i), 'Must not create database');
  assert.ok(!migSrc.match(/USE\s+`?tribute_coop_db`?/i), 'Must not use hardcoded database');
  assert.ok(migSrc.includes('membership_type'), 'Must alter membership_type');
  assert.ok(migSrc.includes('recorded_by_id'), 'Must add recorded_by_id');
  assert.ok(migSrc.includes('recorded_by_role'), 'Must add recorded_by_role');
  assert.ok(migSrc.includes('audit_id'), 'Must add audit_id');
  assert.ok(migSrc.includes('uniq_member_payment_ref_type'), 'Must have idempotency unique index');

  const storeSrc = readIfExists(STORE_PATH);
  assert.ok(storeSrc.includes('SELECT * FROM coop_members WHERE member_no = ? LIMIT 1 FOR UPDATE'), 'Store must use SELECT ... FOR UPDATE');
});

test('Bridge Test 7: Reconciliation and backfill accessible via UI and API route with role guards', () => {
  assert.ok(fs.existsSync(RECONCILE_API_PATH), 'Reconciliation API route must exist');
  const recSrc = readIfExists(RECONCILE_API_PATH);
  assert.ok(recSrc.includes('requireApiRole'), 'Must guard reconciliation route');
  assert.ok(recSrc.includes('reconcileBorrowerMemberships'), 'Must call reconcileBorrowerMemberships');

  const officerPageSrc = readIfExists(OFFICER_MEMBERS_PAGE_PATH);
  assert.ok(officerPageSrc.includes('handleSyncExistingBorrowers'), 'AO members page must have Sync Borrowers action');
  assert.ok(officerPageSrc.includes('Sync Borrowers'), 'AO members page must label Sync Borrowers button');

  const adminPageSrc = readIfExists(ADMIN_MEMBERS_PAGE_PATH);
  assert.ok(adminPageSrc.includes('handleSyncExistingBorrowers'), 'Admin members page must have Sync Borrowers action');
  assert.ok(adminPageSrc.includes('Sync Borrowers'), 'Admin members page must label Sync Borrowers button');
});
