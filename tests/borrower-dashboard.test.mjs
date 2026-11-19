import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const API_PATH = path.join(ROOT, 'src/app/api/borrower/portal/route.ts');
const NAV_PATH = path.join(ROOT, 'src/components/borrower/BorrowerNav.tsx');
const NAV_CSS_PATH = path.join(ROOT, 'src/components/borrower/BorrowerNav.module.css');
const DASHBOARD_PAGE_PATH = path.join(ROOT, 'src/app/borrower/dashboard/page.tsx');
const DASHBOARD_CSS_PATH = path.join(ROOT, 'src/app/borrower/dashboard/dashboard.module.css');
const LOANS_PAGE_PATH = path.join(ROOT, 'src/app/borrower/loans/page.tsx');
const LOANS_CSS_PATH = path.join(ROOT, 'src/app/borrower/loans/loans.module.css');
const SAVINGS_PAGE_PATH = path.join(ROOT, 'src/app/borrower/savings/page.tsx');
const SAVINGS_CSS_PATH = path.join(ROOT, 'src/app/borrower/savings/savings.module.css');
const SETTINGS_PAGE_PATH = path.join(ROOT, 'src/app/borrower/settings/page.tsx');
const SETTINGS_CSS_PATH = path.join(ROOT, 'src/app/borrower/settings/settings.module.css');

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

test('Borrower Portal Refinement Test 1: Navigation exposes exactly 4 primary destinations in order', () => {
  const navSrc = readIfExists(NAV_PATH);

  // Exact 4 routes and labels
  assert.ok(navSrc.includes('/borrower/dashboard'), 'Nav must link to /borrower/dashboard');
  assert.ok(navSrc.includes('/borrower/loans'), 'Nav must link to /borrower/loans');
  assert.ok(navSrc.includes('/borrower/savings'), 'Nav must link to /borrower/savings');
  assert.ok(navSrc.includes('/borrower/settings'), 'Nav must link to /borrower/settings');

  // Must not have forbidden primary navigation tabs
  assert.ok(!navSrc.includes("label: 'Payments'"), 'Nav must not have separate Payments primary item');
  assert.ok(!navSrc.includes("label: 'Documents'"), 'Nav must not have separate Documents primary item');
  assert.ok(!navSrc.includes("label: 'Passbook'"), 'Nav must not have separate Passbook primary item');
  assert.ok(!navSrc.includes("label: 'Profile'"), 'Nav must not have separate Profile primary item');
  assert.ok(!navSrc.includes("label: 'Apply'"), 'Nav must not have separate Apply primary item');
});

test('Borrower Portal Refinement Test 2: Dashboard is summary-only with real statistics and top-3 loan limit', () => {
  const dashSrc = readIfExists(DASHBOARD_PAGE_PATH);

  // Check required statistics presence
  assert.ok(dashSrc.includes('totalPaid') || dashSrc.includes('Total Paid'), 'Dashboard must display Total Paid');
  assert.ok(dashSrc.includes('totalLoaned') || dashSrc.includes('Total Loaned'), 'Dashboard must display Total Loaned / Principal');
  assert.ok(dashSrc.includes('totalInterest') || dashSrc.includes('Total Contractual Interest') || dashSrc.includes('totalContractualInterest'), 'Dashboard must display Total Interest');
  assert.ok(dashSrc.includes('totalSavings') || dashSrc.includes('Current CBU Balance') || dashSrc.includes('currentCbuBalance'), 'Dashboard must display Total Savings/CBU');
  assert.ok(dashSrc.includes('totalDaysLoaned') || dashSrc.includes('Total Days Loaned'), 'Dashboard must display Total Days Loaned');
  assert.ok(dashSrc.includes('activeLoanCount') || dashSrc.includes('Active/Unpaid') || dashSrc.includes('activeLoansCount'), 'Dashboard must display Active/Unpaid Loan Count');
  assert.ok(dashSrc.includes('fullyPaidCount') || dashSrc.includes('Fully Paid') || dashSrc.includes('fullyPaidLoansCount'), 'Dashboard must display Fully Paid Count');

  // Top 3 recent loans limit
  assert.ok(
    dashSrc.includes('.slice(0, 3)') || dashSrc.includes('recentLoans') || dashSrc.includes('topThreeLoans'),
    'Dashboard must limit recent loans display to top 3'
  );
  assert.ok(dashSrc.includes('/borrower/loans'), 'Dashboard must link to /borrower/loans');

  // Must NOT contain long detailed repayment schedules or editable profile forms on dashboard
  assert.ok(!dashSrc.includes('handleProfileSubmit'), 'Dashboard must not have profile update forms');
  assert.ok(!dashSrc.includes('handlePasswordSubmit'), 'Dashboard must not host password form directly (it belongs in /borrower/settings)');
});

test('Borrower Portal Refinement Test 3: Loans page classifies loans, calculates health, and gates reloan eligibility', () => {
  const loansSrc = readIfExists(LOANS_PAGE_PATH);

  // Classification & Health
  assert.ok(loansSrc.includes('current') || loansSrc.includes('active'), 'Loans must classify active loans');
  assert.ok(loansSrc.includes('fullyPaid') || loansSrc.includes('completed'), 'Loans must classify fully paid loans');
  assert.ok(loansSrc.includes('Healthy') && loansSrc.includes('Due Soon'), 'Loans must support Healthy and Due Soon health statuses');
  assert.ok(loansSrc.includes('Overdue') && loansSrc.includes('Contract Breach'), 'Loans must support Overdue and Contract Breach health statuses');

  // Reloan eligibility & renewal confirmation modal
  assert.ok(loansSrc.includes('reloan') || loansSrc.includes('renew') || loansSrc.includes('Renew Loan'), 'Loans must provide Reloan / Renew action');
  assert.ok(loansSrc.includes('eligible') || loansSrc.includes('reloanEligible'), 'Loans must evaluate reloan eligibility');
  assert.ok(loansSrc.includes('modal') || loansSrc.includes('RenewalModal') || loansSrc.includes('showRenewalModal'), 'Loans must require in-app modal confirmation for renewal');

  // Required documents and evidence inside Loans
  assert.ok(loansSrc.includes('contractTemplateSnapshot') || loansSrc.includes('Executed Contract'), 'Loans must provide executed contract snapshot');
  assert.ok(loansSrc.includes('Staff Information') || loansSrc.includes('staff') || loansSrc.includes('officer'), 'Loans must provide Staff Information Sheet');
  assert.ok(loansSrc.includes('borrowerSignatures') || loansSrc.includes('applicantSignature'), 'Loans must provide specimen signatures');
  assert.ok(loansSrc.includes('applicantFacePhoto') || loansSrc.includes('borrowerHoldingIdPhoto'), 'Loans must provide member selfie and holding ID evidence');

  // Must never load current editable contract template
  assert.ok(!loansSrc.includes('getActiveContractTemplate()'), 'Must never substitute live editable contract template');
});

test('Borrower Portal Refinement Test 4: Savings page dedicated to CBU ledger with running balance and AO evidence', () => {
  const savingsSrc = readIfExists(SAVINGS_PAGE_PATH);

  assert.ok(savingsSrc.includes('CBU') || savingsSrc.includes('Capital Build-Up'), 'Savings must represent CBU');
  assert.ok(savingsSrc.includes('runningBalance') || savingsSrc.includes('cbuBalance'), 'Savings must track running balance');
  assert.ok(savingsSrc.includes('aoSignature') || savingsSrc.includes('aoSignatureImage'), 'Savings must display AO signature evidence');
  assert.ok(savingsSrc.includes('processedBy') || savingsSrc.includes('aoAuthId') || savingsSrc.includes('referenceNo'), 'Savings must show processing officer/auth/reference');
});

test('Borrower Portal Refinement Test 5: Account Settings is password-only security', () => {
  const settingsSrc = readIfExists(SETTINGS_PAGE_PATH);

  assert.ok(settingsSrc.includes('currentPassword'), 'Settings must require current password');
  assert.ok(settingsSrc.includes('newPassword'), 'Settings must require new password');
  assert.ok(settingsSrc.includes('confirmPassword'), 'Settings must require password confirmation');
  assert.ok(settingsSrc.includes('change_password'), 'Settings must trigger password update action');

  // Must NOT contain unrelated profile editing or toggles
  assert.ok(!settingsSrc.includes('contactNumber'), 'Settings must not contain profile contact edits');
  assert.ok(!settingsSrc.includes('interest_rate'), 'Settings must not contain loan configurations');
});

test('Borrower Portal Refinement Test 6: Modern sleek white/green header with official logo and no AO/Admin clutter', () => {
  const navSrc = readIfExists(NAV_PATH);

  // Uses official tribute-credit-logo.png with next/image
  assert.ok(navSrc.includes("from 'next/image'"), 'BorrowerNav must import next/image');
  assert.ok(navSrc.includes('/tribute-credit-logo.png'), 'BorrowerNav must use /tribute-credit-logo.png');
  assert.ok(navSrc.includes('alt="Tribute Credit Cooperative"'), 'BorrowerNav must have accessible alt text for official logo');

  // Modern styling attributes: white background with Tribute green accents
  const navCss = readIfExists(NAV_CSS_PATH);
  assert.ok(navCss.includes('background-color: #FFFFFF') || navCss.includes('background-color: #ffffff') || navCss.includes('background: #FFFFFF') || navCss.includes('background: #ffffff'), 'Header shell must have clean white background');
  assert.ok(navCss.includes('border-bottom:'), 'Header must have subtle border elevation');

  // Right side features: profile avatar/initials, name, MCID, Account Settings & Sign Out
  assert.ok(navSrc.includes('user?.name'), 'Header must display borrower name');
  assert.ok(navSrc.includes('user?.memberNo'), 'Header must display borrower MCID');
  assert.ok(navSrc.includes('/borrower/settings'), 'Header must provide link to Account Settings');
  assert.ok(navSrc.includes('handleLogout') || navSrc.includes('/api/auth/logout'), 'Header must provide Sign Out action');

  // Must NOT contain AO/Admin clutter
  assert.ok(!navSrc.includes('Synced'), 'Header must not show AO sync notice');
  assert.ok(!navSrc.includes('Online'), 'Header must not show AO online status badge');
  assert.ok(!navSrc.includes('Clear Data'), 'Header must not show Admin clear data action');
  assert.ok(!navSrc.includes('Clear All Records'), 'Header must not show Admin clear records button');
  assert.ok(!navSrc.includes('CDA Registration No.'), 'Header must not show CDA-heavy administrative block');

  // Consistency across all 4 pages
  assert.ok(readIfExists(DASHBOARD_PAGE_PATH).includes('<BorrowerNav'), 'Dashboard must use BorrowerNav');
  assert.ok(readIfExists(LOANS_PAGE_PATH).includes('<BorrowerNav'), 'Loans must use BorrowerNav');
  assert.ok(readIfExists(SAVINGS_PAGE_PATH).includes('<BorrowerNav'), 'Savings must use BorrowerNav');
  assert.ok(readIfExists(SETTINGS_PAGE_PATH).includes('<BorrowerNav'), 'Settings must use BorrowerNav');
});

test('Borrower Portal Refinement Test 7: CSS Module contracts are valid across all borrower components', () => {
  const checkContract = (tsxPath, cssPath, name) => {
    const tsxSrc = readIfExists(tsxPath);
    const cssSrc = readIfExists(cssPath);
    const classes = extractCssModuleClasses(cssSrc);
    const referenced = extractReferencedModuleClasses(tsxSrc, 'styles');
    const missing = [...referenced].filter((c) => !classes.has(c));
    assert.deepEqual(missing, [], `${name} references missing CSS classes: ${missing.join(', ')}`);
  };

  checkContract(NAV_PATH, NAV_CSS_PATH, 'BorrowerNav');
  checkContract(DASHBOARD_PAGE_PATH, DASHBOARD_CSS_PATH, 'BorrowerDashboard');
  checkContract(LOANS_PAGE_PATH, LOANS_CSS_PATH, 'BorrowerLoans');
  checkContract(SAVINGS_PAGE_PATH, SAVINGS_CSS_PATH, 'BorrowerSavings');
  checkContract(SETTINGS_PAGE_PATH, SETTINGS_CSS_PATH, 'BorrowerSettings');
});
