import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const API_PATH = path.join(ROOT, 'src/app/api/borrower/portal/route.ts');
const DASHBOARD_PAGE_PATH = path.join(ROOT, 'src/app/borrower/dashboard/page.tsx');
const DASHBOARD_CSS_PATH = path.join(ROOT, 'src/app/borrower/dashboard/dashboard.module.css');

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

test('Borrower Dashboard Test A: Protected portal API exists and enforces authentication and borrower ownership', () => {
  assert.ok(fs.existsSync(API_PATH), 'src/app/api/borrower/portal/route.ts must exist');
  const apiSrc = readIfExists(API_PATH);

  // Checks session token and borrower role
  assert.ok(apiSrc.includes('verifyJwtToken') || apiSrc.includes('coop_auth_token'), 'API must verify session token');
  assert.ok(apiSrc.includes('export async function GET'), 'API must have GET handler');
  assert.ok(apiSrc.includes('export async function POST'), 'API must have POST handler');

  // Enforces ownership matching
  assert.ok(
    apiSrc.includes('borrowerEmail') || apiSrc.includes('email') || apiSrc.includes('user.email'),
    'API must isolate borrower records by user identity'
  );
  assert.ok(
    !apiSrc.includes('const firstLoan = allLoans[0]'),
    'API must never blindly trust or pick the first assessment'
  );
});

test('Borrower Dashboard Test B: Dashboard UI connects to real portal API and does not contain hard-coded demo loans', () => {
  assert.ok(fs.existsSync(DASHBOARD_PAGE_PATH), 'src/app/borrower/dashboard/page.tsx must exist');
  const pageSrc = readIfExists(DASHBOARD_PAGE_PATH);

  // Must call /api/borrower/portal
  assert.ok(pageSrc.includes('/api/borrower/portal'), 'Dashboard must fetch from /api/borrower/portal');

  // Must NOT contain hard-coded mock loans
  assert.ok(!pageSrc.includes("loanCode: 'LN-2026-042'"), 'Must not have hard-coded LN-2026-042');
  assert.ok(!pageSrc.includes("principal: '₱ 50,000.00'"), 'Must not have hard-coded principal');
  assert.ok(!pageSrc.includes("remainingBalance: '₱ 28,450.00'"), 'Must not have hard-coded remaining balance');
});

test('Borrower Dashboard Test C: Canonical lifecycle timeline respects pending_ao_disbursement and honest status progression', () => {
  const pageSrc = readIfExists(DASHBOARD_PAGE_PATH);

  // Must handle canonical status and explain awaiting confirmation
  assert.ok(pageSrc.includes('pending_ao_disbursement'), 'Must handle pending_ao_disbursement');
  assert.ok(pageSrc.includes('disbursed'), 'Must handle disbursed status');
  assert.ok(
    pageSrc.includes('Released by Admin') || pageSrc.includes('Awaiting AO Confirmation') || pageSrc.includes('awaiting_ao'),
    'Must explain funds released by Admin awaiting officer handover'
  );
});

test('Borrower Dashboard Test D: Passbook booklet, payment ledger, and exact executed contract snapshot are accessible', () => {
  const pageSrc = readIfExists(DASHBOARD_PAGE_PATH);

  assert.ok(pageSrc.includes('PassbookBooklet'), 'Must render or provide PassbookBooklet');
  assert.ok(pageSrc.includes('LoanPaymentLedger') || pageSrc.includes('paymentRecords'), 'Must render payment ledger');
  assert.ok(
    pageSrc.includes('contractTemplateSnapshot') || pageSrc.includes('Executed Contract'),
    'Must support executed contract snapshot viewing'
  );
  assert.ok(
    !pageSrc.includes('getActiveContractTemplate()'),
    'Borrower dashboard must never substitute live editable contract template'
  );
});

test('Borrower Dashboard Test E: Dashboard CSS module contract and responsive classes', () => {
  assert.ok(fs.existsSync(DASHBOARD_CSS_PATH), 'src/app/borrower/dashboard/dashboard.module.css must exist');
  const pageSrc = readIfExists(DASHBOARD_PAGE_PATH);
  const cssSrc = readIfExists(DASHBOARD_CSS_PATH);

  const classes = extractCssModuleClasses(cssSrc);
  const referenced = extractReferencedModuleClasses(pageSrc, 'styles');

  const missing = [...referenced].filter((c) => !classes.has(c));
  assert.deepEqual(missing, [], `Borrower Dashboard references missing CSS classes: ${missing.join(', ')}`);
});
