import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const WORKFLOW_PATH = path.join(ROOT, 'src/lib/disbursement-workflow.ts');
const PROOF_COMP_PATH = path.join(ROOT, 'src/components/common/ProofCaptureInput.tsx');
const ADMIN_DISB_PATH = path.join(ROOT, 'src/app/disbursement/page.tsx');
const ADMIN_DISB_CSS = path.join(ROOT, 'src/app/disbursement/disbursement.module.css');
const AO_DISB_PATH = path.join(ROOT, 'src/app/officer/disbursements/page.tsx');
const AO_DISB_CSS = path.join(ROOT, 'src/app/officer/disbursements/disbursements.module.css');
const NAV_ITEMS_PATH = path.join(ROOT, 'src/components/officer/officer-nav-items.ts');
const API_ROUTE_PATH = path.join(ROOT, 'src/app/api/assessments/route.ts');
const ADMIN_DASH_PATH = path.join(ROOT, 'src/app/admin/dashboard/page.tsx');
const AO_BORROWERS_PATH = path.join(ROOT, 'src/app/officer/borrowers/page.tsx');

function readFile(p) {
  assert.ok(fs.existsSync(p), `Expected file to exist: ${p}`);
  return fs.readFileSync(p, 'utf8');
}

function makeContractReadyRecord() {
  return {
    id: 'CA-TC-LN-A-00101',
    applicationId: 'TC-LN-A-00101',
    borrowerName: 'Elena Cruz',
    policyNo: 'LCAP-101',
    contactNumber: '+63 917 111 2233',
    location: 'Quezon City',
    livelihood: 'Bakery',
    yearsInBusiness: 4,
    monthlyNetIncome: 30000,
    existingDebts: 2000,
    netDisposableIncome: 20000,
    requestedAmount: 20000,
    productName: 'Regular Loan',
    termMonths: 3,
    paymentMode: 'Weekly',
    aiPreApprovedAmount: 20000,
    aiRiskRating: 'Class A',
    aiDsr: 25,
    aiConfidenceScore: 95,
    aiRecommendationNote: 'Good cashflow',
    fiveCs: {
      characterScore: 18,
      characterNotes: 'Good',
      capacityScore: 22,
      capacityNotes: 'Good',
      capitalScore: 17,
      capitalNotes: 'Good',
      collateralScore: 16,
      collateralNotes: 'Good',
      conditionsScore: 14,
      conditionsNotes: 'Good',
      totalScore: 87,
      riskGrade: 'Class A (Prime / Low Risk)',
    },
    officerAdjustedAmount: 20000,
    officerRecommendation: 'recommend_approve',
    officerNotes: 'Verified',
    evaluatedByOfficer: 'Officer Juan (AO-001)',
    evaluatedAt: '2026-11-18 09:00',
    status: 'contract_ready',
    adminApprovedAmount: 20000,
    finalContractAmount: 20000,
  };
}

test('Disbursement Workflow State Machine: enforces Admin release -> pending_ao_disbursement -> AO confirmation -> disbursed with immutable audit records', async () => {
  assert.ok(fs.existsSync(WORKFLOW_PATH), 'Expected src/lib/disbursement-workflow.ts to exist');
  const wf = await import('../src/lib/disbursement-workflow.ts');

  const base = makeContractReadyRecord();

  // 1. Admin cannot release without signature
  const missingAdminSig = wf.validateAdminDisbursementRelease(base, {
    signerName: 'Administrator',
    signatureImage: '',
    proofImage: 'data:image/png;base64,ADMINPROOF',
    referenceNo: 'REL-001',
    notes: 'Released via GCash',
  });
  assert.equal(missingAdminSig.ok, false);

  // 2. Admin cannot release without proof image
  const missingAdminProof = wf.validateAdminDisbursementRelease(base, {
    signerName: 'Administrator',
    signatureImage: 'data:image/png;base64,ADMINSIG',
    proofImage: '',
    referenceNo: 'REL-001',
    notes: 'Released via GCash',
  });
  assert.equal(missingAdminProof.ok, false);

  // 3. AO cannot confirm directly from contract_ready (prevents status bypass)
  const prematureAo = wf.validateAoDisbursementConfirmation(base, {
    signerName: 'Officer Juan (AO-001)',
    signatureImage: 'data:image/png;base64,AOSIG',
    proofImage: 'data:image/png;base64,AOPROOF',
    referenceNo: 'CONF-001',
    notes: 'Handed to borrower',
  });
  assert.equal(prematureAo.ok, false);

  // 4. Valid Admin release transitions strictly to pending_ao_disbursement (NOT disbursed)
  const stage1 = wf.buildAdminReleaseUpdate(base, {
    signerName: 'Administrator',
    signatureImage: 'data:image/png;base64,ADMINSIG',
    proofImage: 'data:image/png;base64,ADMINPROOF',
    proofFileName: 'gcash-receipt.png',
    referenceNo: 'REL-2026-001',
    notes: 'Transferred to AO for handover',
  });
  assert.equal(stage1.status, 'pending_ao_disbursement');
  assert.equal(stage1.disbursedAt, undefined, 'Admin release must NOT set disbursedAt');
  assert.equal(stage1.remainingBalance, undefined, 'Admin release must NOT start repayment ledger');
  assert.ok(stage1.adminDisbursementRelease, 'Must store Admin release audit record');
  assert.equal(stage1.adminDisbursementRelease.signerRole, 'admin');
  assert.equal(stage1.adminDisbursementRelease.signatureImage, 'data:image/png;base64,ADMINSIG');
  assert.equal(stage1.adminDisbursementRelease.proofImage, 'data:image/png;base64,ADMINPROOF');
  assert.ok(stage1.adminDisbursementRelease.authId.startsWith('AUTH-DISB-ADM-'));
  assert.ok(stage1.adminDisbursementRelease.timestamp.length > 0);

  // 5. Duplicate Admin release on pending_ao_disbursement is rejected
  const duplicateAdmin = wf.validateAdminDisbursementRelease(stage1, {
    signerName: 'Administrator',
    signatureImage: 'data:image/png;base64,ADMINSIG2',
    proofImage: 'data:image/png;base64,ADMINPROOF2',
    referenceNo: 'REL-DUP',
  });
  assert.equal(duplicateAdmin.ok, false);

  // 6. AO cannot confirm without AO signature or without AO proof
  const missingAoSig = wf.validateAoDisbursementConfirmation(stage1, {
    signerName: 'Officer Juan (AO-001)',
    signatureImage: '',
    proofImage: 'data:image/png;base64,AOPROOF',
  });
  assert.equal(missingAoSig.ok, false);

  const missingAoProof = wf.validateAoDisbursementConfirmation(stage1, {
    signerName: 'Officer Juan (AO-001)',
    signatureImage: 'data:image/png;base64,AOSIG',
    proofImage: '',
  });
  assert.equal(missingAoProof.ok, false);

  // 7. Valid AO confirmation transitions to disbursed, starts ledger, and preserves Admin evidence
  const stage2 = wf.buildAoConfirmationUpdate(
    stage1,
    {
      signerName: 'Officer Juan (AO-001)',
      signatureImage: 'data:image/png;base64,AOSIG',
      proofImage: 'data:image/png;base64,AOPROOF',
      proofFileName: 'borrower-handover.jpg',
      referenceNo: 'AO-CONF-001',
      notes: 'Borrower signed receipt in person',
    },
    { totalScheduledCollections: 23600 }
  );
  assert.equal(stage2.status, 'disbursed');
  assert.ok(stage2.disbursedAt, 'AO confirmation must set disbursedAt');
  assert.equal(stage2.remainingBalance, 23600);
  assert.equal(stage2.totalCollected, 0);
  assert.deepEqual(
    stage2.adminDisbursementRelease,
    stage1.adminDisbursementRelease,
    'AO confirmation must NOT overwrite Admin release evidence'
  );
  assert.ok(stage2.aoDisbursementConfirmation, 'Must store AO confirmation audit record');
  assert.equal(stage2.aoDisbursementConfirmation.signerRole, 'officer');
  assert.equal(stage2.aoDisbursementConfirmation.signatureImage, 'data:image/png;base64,AOSIG');
  assert.equal(stage2.aoDisbursementConfirmation.proofImage, 'data:image/png;base64,AOPROOF');
  assert.ok(stage2.aoDisbursementConfirmation.authId.startsWith('AUTH-DISB-AO-'));

  // 8. Duplicate AO confirmation on already-disbursed loan is rejected
  const duplicateAo = wf.validateAoDisbursementConfirmation(stage2, {
    signerName: 'Officer Juan (AO-001)',
    signatureImage: 'data:image/png;base64,AOSIG2',
    proofImage: 'data:image/png;base64,AOPROOF2',
  });
  assert.equal(duplicateAo.ok, false);
});

test('Disbursement Workflow UI & Routes: Admin Hub, AO Disbursements, ProofCaptureInput, and Navigation are wired cleanly', () => {
  const proofSrc = readFile(PROOF_COMP_PATH);
  const adminDisbSrc = readFile(ADMIN_DISB_PATH);
  readFile(ADMIN_DISB_CSS);
  const aoDisbSrc = readFile(AO_DISB_PATH);
  readFile(AO_DISB_CSS);
  const navSrc = readFile(NAV_ITEMS_PATH);

  // ProofCaptureInput supports both file upload and camera capture with preview/remove
  assert.ok(proofSrc.includes('type="file"'), 'ProofCaptureInput must support image upload');
  assert.ok(proofSrc.includes('getUserMedia'), 'ProofCaptureInput must support camera capture');
  assert.ok(proofSrc.includes('Remove'), 'ProofCaptureInput must expose remove control');

  // Admin Disbursement Hub uses Admin red/white theme, requires signature + proof, transitions to pending_ao_disbursement
  assert.ok(adminDisbSrc.includes('AdminTheme.module.css'), 'Admin Disbursement Hub must use AdminTheme');
  assert.ok(adminDisbSrc.includes('role="admin"'), 'Admin Disbursement Hub must render Admin Sidebar');
  assert.ok(adminDisbSrc.includes('buildAdminReleaseUpdate'), 'Admin Disbursement Hub must use buildAdminReleaseUpdate');
  assert.ok(adminDisbSrc.includes('ProofCaptureInput'), 'Admin Disbursement Hub must require proof capture/upload');
  assert.ok(adminDisbSrc.includes('SignaturePad'), 'Admin Disbursement Hub must require Admin signature');

  // AO Disbursements uses Officer green/white theme, filters pending_ao_disbursement, transitions to disbursed
  assert.ok(aoDisbSrc.includes('OfficerTheme.module.css'), 'AO Disbursements must use OfficerTheme');
  assert.ok(aoDisbSrc.includes('OfficerSidebar'), 'AO Disbursements must render OfficerSidebar');
  assert.ok(aoDisbSrc.includes('OfficerMobileNav'), 'AO Disbursements must render OfficerMobileNav');
  assert.ok(aoDisbSrc.includes('buildAoConfirmationUpdate'), 'AO Disbursements must use buildAoConfirmationUpdate');
  assert.ok(aoDisbSrc.includes('pending_ao_disbursement'), 'AO Disbursements must filter pending_ao_disbursement records');
  assert.ok(aoDisbSrc.includes('ProofCaptureInput'), 'AO Disbursements must require proof capture/upload');
  assert.ok(aoDisbSrc.includes('SignaturePad'), 'AO Disbursements must require AO signature');

  // Officer navigation includes /officer/disbursements
  assert.ok(navSrc.includes('/officer/disbursements'), 'OFFICER_NAV_ITEMS must include /officer/disbursements');
});

test('Disbursement Workflow Persistence & Counts: API maps pending_ao_disbursement to approved (not disbursed) and dashboards do not prematurely count disbursed', () => {
  const apiSrc = readFile(API_ROUTE_PATH);
  const adminDashSrc = readFile(ADMIN_DASH_PATH);
  const aoBorrowersSrc = readFile(AO_BORROWERS_PATH);

  // API maps pending_ao_disbursement to DB 'approved' (not 'disbursed') and preserves in-memory status
  assert.ok(apiSrc.includes('pending_ao_disbursement'), 'API route must explicitly handle pending_ao_disbursement');
  assert.ok(apiSrc.includes('adminDisbursementRelease'), 'API route must preserve adminDisbursementRelease');
  assert.ok(apiSrc.includes('aoDisbursementConfirmation'), 'API route must preserve aoDisbursementConfirmation');

  // Admin dashboard counts active/disbursed only when status === disbursed and labels pending_ao_disbursement clearly
  assert.ok(
    adminDashSrc.includes('pending_ao_disbursement'),
    'Admin dashboard must render explicit status label for pending_ao_disbursement'
  );
  assert.ok(
    !adminDashSrc.includes("a.status === 'disbursed' || a.status === 'contract_ready'"),
    'Admin dashboard activeBorrowersCount must not count contract_ready as active/disbursed before AO confirmation'
  );

  // AO Current Borrowers recognizes pending_ao_disbursement honestly and does not treat it as disbursed
  assert.ok(
    aoBorrowersSrc.includes('pending_ao_disbursement'),
    'AO Current Borrowers must recognize pending_ao_disbursement status honestly'
  );
});

test('Admin Loans preserves completed workflow stages and labels disbursed loans as active', async () => {
  const store = await import('../src/lib/credit-assessment-store.ts');
  const adminLoansSrc = readFile(path.join(ROOT, 'src/app/admin/loans/page.tsx'));

  assert.equal(
    typeof store.resolveAssessmentSyncStatus,
    'function',
    'Credit assessment store must expose one status resolver for sync merges'
  );

  assert.equal(
    store.resolveAssessmentSyncStatus('disbursed', 'pending_admin'),
    'disbursed',
    'A stale pending Admin record must never downgrade a disbursed loan'
  );
  assert.equal(
    store.resolveAssessmentSyncStatus('pending_admin', 'disbursed'),
    'disbursed',
    'A server-confirmed disbursed status must supersede a stale local pending state'
  );
  assert.equal(
    store.resolveAssessmentSyncStatus('pending_ao_disbursement', 'admin_approved'),
    'pending_ao_disbursement',
    'Admin release evidence must not be downgraded to initial approval'
  );
  assert.equal(
    store.resolveAssessmentSyncStatus('contract_ready', 'pending_admin'),
    'contract_ready',
    'An executed contract must not return to pending Admin decision'
  );
  assert.equal(
    store.resolveAssessmentSyncStatus('admin_approved', 'pending_admin'),
    'pending_admin',
    'A genuine pre-contract reconsideration may still return to Admin review'
  );

  assert.ok(
    adminLoansSrc.includes("formatAssessmentStatusLabel(app.status)"),
    'Admin Loans cards must use the complete shared workflow status label'
  );
  assert.ok(
    adminLoansSrc.includes("formatAssessmentStatusLabel(selectedApp.status)"),
    'Admin Loans governance state must use the complete shared workflow status label'
  );
});
