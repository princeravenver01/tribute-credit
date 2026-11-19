import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const MAPPER_PATH = path.join(ROOT, 'src/lib/borrower-record-mapper.ts');
const MODAL_TSX_PATH = path.join(ROOT, 'src/components/admin/AdminBorrowerDetailsModal.tsx');
const MODAL_CSS_PATH = path.join(ROOT, 'src/components/admin/AdminBorrowerDetailsModal.module.css');
const ADMIN_DASHBOARD_PATH = path.join(ROOT, 'src/app/admin/dashboard/page.tsx');
const ADMIN_LOANS_PATH = path.join(ROOT, 'src/app/admin/loans/page.tsx');

function readIfExists(filePath) {
  assert.ok(fs.existsSync(filePath), `Expected file to exist: ${filePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

function extractCssModuleClasses(cssText) {
  const cleaned = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
  const classes = new Set();
  const regex = /\.([A-Za-z_][A-Za-z0-9_-]*)/g;
  let match;
  while ((match = regex.exec(cleaned)) !== null) {
    classes.add(match[1]);
  }
  return classes;
}

function extractReferencedModuleClasses(tsxText, identifier) {
  const classes = new Set();
  const regex = new RegExp(`\\b${identifier}\\.([A-Za-z_][A-Za-z0-9_-]*)`, 'g');
  let match;
  while ((match = regex.exec(tsxText)) !== null) {
    classes.add(match[1]);
  }
  return classes;
}

test('Admin Borrower Parity: mapper extracts complete AO-equivalent dossier fields without fabricating missing data', async () => {
  assert.ok(fs.existsSync(MAPPER_PATH), 'Expected src/lib/borrower-record-mapper.ts to exist');
  const mapper = await import('../src/lib/borrower-record-mapper.ts');
  assert.equal(typeof mapper.buildBorrowerDetailsViewModel, 'function');

  // 1. Full record extraction
  const fullRecord = {
    id: 'CA-TC-LN-A-00042',
    applicationId: 'TC-LN-A-00042',
    borrowerName: 'Maria Clara Santos',
    mcid: 'TCID-A-00042',
    cidNumber: 'TCID-A-00042',
    policyNo: 'LCAP-042',
    contactNumber: '+63 917 555 0142',
    borrowerEmail: 'maria.santos@tribute.ph',
    location: 'Brgy. Batasan Hills, Quezon City, Metro Manila',
    livelihood: 'Sari-Sari Store & Rice Retail',
    yearsInBusiness: 5,
    monthlyNetIncome: 38000,
    existingDebts: 4500,
    netDisposableIncome: 24500,
    requestedAmount: 25000,
    productName: 'Regular Loan',
    termMonths: 6,
    paymentMode: 'Weekly',
    aiPreApprovedAmount: 22000,
    aiRiskRating: 'Class A (Low Risk)',
    aiDsr: 26.5,
    aiConfidenceScore: 95.4,
    aiRecommendationNote: 'Strong recurring store cashflow.',
    fiveCs: {
      characterScore: 19,
      characterNotes: 'Verified barangay residency.',
      capacityScore: 23,
      capacityNotes: 'Healthy disposable income.',
      capitalScore: 18,
      capitalNotes: 'Inventory verified on-site.',
      collateralScore: 16,
      collateralNotes: 'Co-maker verified.',
      conditionsScore: 14,
      conditionsNotes: 'High neighborhood foot traffic.',
      totalScore: 90,
      riskGrade: 'Class A (Prime / Low Risk)',
    },
    officerAdjustedAmount: 24000,
    officerRecommendation: 'recommend_adjust',
    officerNotes: 'Endorsed with verified store ledger.',
    evaluatedByOfficer: 'Officer Juan (AO-001)',
    evaluatedAt: '2026-11-18 10:15',
    status: 'admin_approved',
    adminApprovedAmount: 23000,
    previousAdminApprovedAmount: 20000,
    reconsiderationJustification: 'Peak holiday inventory restock verified.',
    adminNotes: 'Approved by committee after review.',
    adminActionAt: '2026-11-18 14:30',
    adjustmentCount: 1,
    finalContractAmount: 23000,
    contractExecutedAt: '2026-11-18 16:00',
    applicantFacePhoto: 'data:image/png;base64,FACE',
    borrowerHoldingIdPhoto: 'data:image/png;base64,HOLDID',
    borrowerSignatures: [
      { signature: 'data:image/png;base64,BS1', authId: 'AUTH-BRW-1', timestamp: 'Nov 18, 2026 04:01 PM' },
    ],
    officerSignatures: [
      { signature: 'data:image/png;base64,OS1', authId: 'AUTH-AO-1', timestamp: 'Nov 18, 2026 04:02 PM' },
    ],
    adminSignatures: [
      { signature: 'data:image/png;base64,AS1', authId: 'AUTH-ADM-1', timestamp: 'Nov 18, 2026 02:30 PM' },
    ],
    disbursementMode: 'online',
    disbursementChannel: 'GCash',
    disbursementAccountNumber: '09175550142',
    disbursedAt: '2026-11-19',
    disbursedBy: 'Cashier Ana',
    disbursementReferenceNo: 'DISB-2026-0042',
    totalCollected: 5000,
    remainingBalance: 26280,
    savingsBalance: 1650,
    loanCycle: 2,
    spouseName: 'Jose Santos',
    membershipDate: 'Jan 12, 2024',
    paymentLedgerRecords: [
      { installmentNo: 1, paymentSchedule: 'Nov 26, 2026', status: 'Paid', datePaid: 'Nov 26, 2026', principalAmount: 23000, payment: 5000, loanBalance: 26280 },
    ],
    savingsLedgerRecords: [
      { id: 'SAV-1', date: 'Nov 19, 2026', type: 'deposit', amount: 500, runningBalance: 1650, referenceNo: 'REF-1' },
    ],
    fullProfile: {
      step1: {
        birthDate: '1988-05-14',
        sex: 'Female',
        civilStatus: 'Married',
        nationality: 'Filipino',
        idType: 'PhilSys National ID',
        idNumber: 'PSN-1234-5678',
      },
      step2: {
        addressLine1: '123 Commonwealth Ave',
        barangay: 'Batasan Hills',
        city: 'Quezon City',
        province: 'Metro Manila',
        email: 'maria.santos@tribute.ph',
        residenceType: 'Owned',
      },
      govIds: [{ type: 'PhilSys National ID', number: 'PSN-1234-5678' }],
      dependants: [{ firstName: 'Jose', lastName: 'Santos', relation: 'Spouse', age: 39 }],
      step4: {
        occupation: 'Sari-Sari Store & Rice Retail',
        businessName: 'Maria Variety Store',
        businessType: 'Retail',
        yearsInLivelihood: 5,
        monthlyNetIncome: 38000,
        monthlyHouseholdExpenses: 9000,
        coMakerName: 'Pedro Reyes',
        coMakerRelationship: 'Brother',
        coMakerContact: '+63 918 222 3344',
      },
      assets: [{ description: 'Commercial Freezer', estimatedValue: 28000 }],
      otherIncomes: [{ source: 'Load & E-Wallet', monthlyAmount: 4500 }],
      liabilities: [{ creditor: 'Supplier Credit', monthlyPayment: 4500, remainingBalance: 12000 }],
      attachments: [{ label: 'Barangay Clearance', name: 'brgy-clearance.pdf' }],
    },
  };

  const fullVm = mapper.buildBorrowerDetailsViewModel(fullRecord);
  assert.equal(fullVm.identity.borrowerName, 'Maria Clara Santos');
  assert.equal(fullVm.identity.mcid, 'TCID-A-00042');
  assert.equal(fullVm.identity.loanReference, 'TC-LN-A-00042');
  assert.equal(fullVm.identity.policyNo, 'LCAP-042');
  assert.equal(fullVm.identity.email, 'maria.santos@tribute.ph');
  assert.equal(fullVm.identity.birthDate, '1988-05-14');
  assert.equal(fullVm.identity.civilStatus, 'Married');
  assert.equal(fullVm.identity.spouseName, 'Jose Santos');
  assert.equal(fullVm.identity.govIds.length, 1);
  assert.equal(fullVm.identity.dependants.length, 1);

  assert.equal(fullVm.livelihood.businessName, 'Maria Variety Store');
  assert.equal(fullVm.livelihood.monthlyNetIncome, 38000);
  assert.equal(fullVm.livelihood.existingDebts, 4500);
  assert.equal(fullVm.livelihood.netDisposableIncome, 24500);
  assert.equal(fullVm.livelihood.assets.length, 1);
  assert.equal(fullVm.livelihood.otherIncomes.length, 1);
  assert.equal(fullVm.livelihood.liabilities.length, 1);
  assert.equal(fullVm.livelihood.coMaker?.name, 'Pedro Reyes');

  assert.equal(fullVm.assessment.fiveCs?.conditionsScore, 14);
  assert.equal(fullVm.assessment.fiveCs?.totalScore, 90);
  assert.equal(fullVm.governance.previousAdminApprovedAmount, 20000);
  assert.equal(fullVm.governance.reconsiderationJustification, 'Peak holiday inventory restock verified.');
  assert.equal(fullVm.governance.adjustmentCount, 1);

  assert.equal(fullVm.documents.attachments.length, 1);
  assert.equal(fullVm.signatures.borrowerSignatures[0].authId, 'AUTH-BRW-1');
  assert.equal(fullVm.signatures.officerSignatures[0].authId, 'AUTH-AO-1');
  assert.equal(fullVm.signatures.adminSignatures[0].authId, 'AUTH-ADM-1');

  assert.equal(fullVm.ledger.totalCollected, 5000);
  assert.equal(fullVm.ledger.remainingBalance, 26280);
  assert.equal(fullVm.ledger.savingsBalance, 1650);
  assert.equal(fullVm.ledger.paymentRecords.length, 1);
  assert.equal(fullVm.ledger.savingsRecords.length, 1);

  // 2. Sparse record: NEVER fabricate unavailable data
  const sparseRecord = {
    id: 'CA-SPARSE-1',
    applicationId: 'TC-LN-A-00099',
    borrowerName: 'Juan Dela Cruz',
    policyNo: '',
    contactNumber: '',
    location: '',
    livelihood: '',
    yearsInBusiness: 0,
    monthlyNetIncome: 0,
    existingDebts: 0,
    netDisposableIncome: 0,
    requestedAmount: 10000,
    productName: 'Regular Loan',
    termMonths: 3,
    paymentMode: 'Weekly',
    aiPreApprovedAmount: 0,
    aiRiskRating: '',
    aiDsr: 0,
    aiConfidenceScore: 0,
    aiRecommendationNote: '',
    fiveCs: undefined,
    officerAdjustedAmount: 0,
    officerRecommendation: 'recommend_approve',
    officerNotes: '',
    evaluatedByOfficer: '',
    evaluatedAt: '',
    status: 'pending_admin',
  };

  const sparseVm = mapper.buildBorrowerDetailsViewModel(sparseRecord);
  assert.equal(sparseVm.identity.mcid, null);
  assert.equal(sparseVm.identity.birthDate, null);
  assert.equal(sparseVm.identity.civilStatus, null);
  assert.equal(sparseVm.identity.spouseName, null);
  assert.equal(sparseVm.identity.email, null);
  assert.equal(sparseVm.livelihood.businessName, null);
  assert.equal(sparseVm.livelihood.coMaker, null);
  assert.deepEqual(sparseVm.identity.govIds, []);
  assert.deepEqual(sparseVm.identity.dependants, []);
  assert.deepEqual(sparseVm.signatures.borrowerSignatures, []);
  assert.deepEqual(sparseVm.signatures.officerSignatures, []);
  assert.deepEqual(sparseVm.signatures.adminSignatures, []);
  assert.equal(sparseVm.documents.applicantFacePhoto, null);
});

test('Admin Borrower Parity: AdminBorrowerDetailsModal exposes all AO dossier sections and valid CSS-module contract', () => {
  const modalTsx = readIfExists(MODAL_TSX_PATH);
  const modalCss = readIfExists(MODAL_CSS_PATH);

  // CSS-module contract
  const referenced = extractReferencedModuleClasses(modalTsx, 'styles');
  const defined = extractCssModuleClasses(modalCss);
  assert.ok(referenced.size > 0, 'Expected AdminBorrowerDetailsModal to use CSS-module styles.*');
  const missing = [...referenced].filter((cls) => !defined.has(cls));
  assert.deepEqual(missing, [], `AdminBorrowerDetailsModal references missing CSS classes: ${missing.join(', ')}`);

  // Must render complete AO parity sections including Passbook & Ledger
  for (const expectedSnippet of [
    'buildBorrowerDetailsViewModel',
    'PassbookBooklet',
    'LoanPaymentLedger',
    'OfficialSignatureBlock',
    'Profile &amp; Financials',
    'Loan, 5 Cs &amp; Governance',
    'Documents &amp; Signatures',
    'Passbook &amp; Ledger',
    'aria-label="Close borrower dossier"',
  ]) {
    assert.ok(
      modalTsx.includes(expectedSnippet),
      `Expected AdminBorrowerDetailsModal.tsx to include "${expectedSnippet}"`
    );
  }
});

test('Admin Borrower Parity: both /admin/dashboard and /admin/loans expose full borrower dossier and deep-linking while preserving Admin controls', () => {
  const dashboardSrc = readIfExists(ADMIN_DASHBOARD_PATH);
  const loansSrc = readIfExists(ADMIN_LOANS_PATH);

  // Dashboard wires AdminBorrowerDetailsModal & deep-links to /admin/loans?appId=
  assert.ok(dashboardSrc.includes('AdminBorrowerDetailsModal'), 'Dashboard must render AdminBorrowerDetailsModal');
  assert.ok(dashboardSrc.includes('/admin/loans?appId='), 'Dashboard Review action must deep-link with ?appId=');
  assert.ok(dashboardSrc.includes('View Details'), 'Dashboard must expose View Details action');

  // Loans wires AdminBorrowerDetailsModal, consumes ?appId=, includes Conditions 5th C, and preserves Admin approval controls
  assert.ok(loansSrc.includes('AdminBorrowerDetailsModal'), 'Admin Loans must render AdminBorrowerDetailsModal');
  assert.ok(loansSrc.includes("params.get('appId')"), 'Admin Loans must consume ?appId= deep-link');
  assert.ok(loansSrc.includes('conditionsScore'), 'Admin Loans must display 5th C (Conditions) score');
  assert.ok(loansSrc.includes('handleAdminDecision'), 'Admin Loans must preserve Admin decision workflow');
  assert.ok(loansSrc.includes('SignaturePad'), 'Admin Loans must preserve Admin 3-signature pad');
});
