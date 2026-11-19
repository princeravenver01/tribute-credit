import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const REPORT_ENGINE_PATH = path.join(ROOT, 'src/lib/report-engine.ts');
const REPORTS_PAGE_PATH = path.join(ROOT, 'src/app/admin/reports/page.tsx');
const REPORTS_CSS_PATH = path.join(ROOT, 'src/app/admin/reports/reports.module.css');

function readIfExists(filePath) {
  assert.ok(fs.existsSync(filePath), `Expected file to exist: ${filePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

test('Milestone 4 Test A: Report Engine computes accurate KPIs, enforces canonical statuses, and builds CSV export', async () => {
  assert.ok(fs.existsSync(REPORT_ENGINE_PATH), 'src/lib/report-engine.ts must exist');
  const reportEngine = await import('../src/lib/report-engine.ts');

  assert.equal(typeof reportEngine.calculatePortfolioMetrics, 'function');
  assert.equal(typeof reportEngine.generateLoanCsv, 'function');

  const fixtures = [
    {
      id: 'CA-1',
      applicationId: 'TC-LN-001',
      borrowerName: 'Maria Santos',
      productName: 'Regular Loan',
      status: 'disbursed',
      finalContractAmount: 20000,
      adminApprovedAmount: 20000,
      totalCollected: 5000,
      remainingBalance: 15000,
      savingsBalance: 1000,
      evaluatedByOfficer: 'Officer Juan',
      disbursedAt: '2026-11-10T10:00:00.000Z',
    },
    {
      id: 'CA-2',
      applicationId: 'TC-LN-002',
      borrowerName: 'Pedro Penduko',
      productName: 'Small Business Loan',
      status: 'pending_ao_disbursement', // Stage 1 released, NOT disbursed yet
      finalContractAmount: 50000,
      adminApprovedAmount: 50000,
      totalCollected: 0,
      remainingBalance: 0,
      evaluatedByOfficer: 'Officer Juan',
      contractExecutedAt: '2026-11-15T10:00:00.000Z',
    },
    {
      id: 'CA-3',
      applicationId: 'TC-LN-003',
      borrowerName: 'Ana Reyes',
      productName: 'Emergency Loan',
      status: 'rejected',
      finalContractAmount: 10000,
      evaluatedByOfficer: 'Officer Clara',
    },
  ];

  const metrics = reportEngine.calculatePortfolioMetrics(fixtures);

  assert.equal(metrics.totalApplications, 3);
  assert.equal(metrics.disbursedCount, 1, 'Only status === disbursed must count towards disbursed loans');
  assert.equal(metrics.disbursedVolume, 20000, 'pending_ao_disbursement must not be added to disbursed volume');
  assert.equal(metrics.awaitingAoReleaseCount, 1);
  assert.equal(metrics.rejectedCount, 1);
  assert.equal(metrics.totalCollected, 5000);
  assert.equal(metrics.totalRemainingBalance, 15000);

  // CSV generation
  const csv = reportEngine.generateLoanCsv(fixtures);
  assert.ok(csv.includes('Loan Reference,Borrower Name,Product,Status,Principal,Total Collected,Remaining Balance,Evaluated By'));
  assert.ok(csv.includes('TC-LN-001,Maria Santos,Regular Loan,disbursed,20000,5000,15000,Officer Juan'));
});

test('Milestone 4 Test B: Reports UI Page wires filter controls, drill-down table, export actions, and CSS-module contract', () => {
  assert.ok(fs.existsSync(REPORTS_PAGE_PATH), 'src/app/admin/reports/page.tsx must exist');
  assert.ok(fs.existsSync(REPORTS_CSS_PATH), 'src/app/admin/reports/reports.module.css must exist');
  const pageSrc = readIfExists(REPORTS_PAGE_PATH);
  const cssSrc = readIfExists(REPORTS_CSS_PATH);

  // Key controls
  assert.ok(pageSrc.includes('Export CSV') || pageSrc.includes('Export to CSV'), 'Must have Export CSV button');
  assert.ok(pageSrc.includes('Print Report') || pageSrc.includes('Print Analytics'), 'Must have Print button');
  assert.ok(pageSrc.includes('calculatePortfolioMetrics'), 'Must use report engine for live metrics');
  assert.ok(pageSrc.includes('Portfolio Distribution') || pageSrc.includes('Status Funnel'), 'Must have portfolio breakdown');

  // CSS module contract
  const classes = new Set();
  const cssClean = cssSrc.replace(/\/\*[\s\S]*?\*\//g, '');
  const classRegex = /\.([A-Za-z_][A-Za-z0-9_-]*)/g;
  let match;
  while ((match = classRegex.exec(cssClean)) !== null) {
    classes.add(match[1]);
  }

  const refRegex = /\bstyles\.([A-Za-z_][A-Za-z0-9_-]*)/g;
  const referenced = new Set();
  while ((match = refRegex.exec(pageSrc)) !== null) {
    referenced.add(match[1]);
  }

  const missing = [...referenced].filter((c) => !classes.has(c));
  assert.deepEqual(missing, [], `Reports page references missing CSS classes: ${missing.join(', ')}`);
});
