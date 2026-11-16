import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

test('Issue 1: Credit assessments layout should not mix step-form-grid on outer wrapper and should handle 1024px tablet stacking cleanly', () => {
  const pagePath = path.join(projectRoot, 'src/app/officer/credit-assessments/page.tsx');
  const cssPath = path.join(projectRoot, 'src/app/officer/credit-assessments/assessments.module.css');
  
  const pageContent = fs.readFileSync(pagePath, 'utf-8');
  const cssContent = fs.readFileSync(cssPath, 'utf-8');

  // Outer workspace wrapper must NOT combine step-form-grid with assessmentLayout
  const hasConflictingStepFormGrid = /className=\{[`'"][^`'"]*assessmentLayout[^`'"]*step-form-grid[^`'"]*[`'"]\}/.test(pageContent) ||
    /className=\{[`'"][^`'"]*step-form-grid[^`'"]*assessmentLayout[^`'"]*[`'"]\}/.test(pageContent);

  assert.equal(
    hasConflictingStepFormGrid,
    false,
    'Outer assessment workspace should not combine global step-form-grid with assessmentLayout'
  );

  // Breakpoint in css must cover 1024px tablet (e.g. max-width: 1024px or max-width: 1199px)
  const covers1024px = /@media\s*\(\s*max-width:\s*(1024px|1199px|1200px)\s*\)/.test(cssContent);
  assert.equal(
    covers1024px,
    true,
    'assessments.module.css must include a breakpoint covering 1024px tablet viewport'
  );
});

test('Issue 2: Officer navigation should have a unified source of truth with matching labels and order', async () => {
  const navItemsPath = path.join(projectRoot, 'src/components/officer/officer-nav-items.ts');
  const sidebarPath = path.join(projectRoot, 'src/components/officer/OfficerSidebar.tsx');
  const mobileNavPath = path.join(projectRoot, 'src/components/officer/OfficerMobileNav.tsx');

  assert.equal(fs.existsSync(navItemsPath), true, 'officer-nav-items.ts must exist as single source of truth');

  const navItemsContent = fs.readFileSync(navItemsPath, 'utf-8');
  const sidebarContent = fs.readFileSync(sidebarPath, 'utf-8');
  const mobileNavContent = fs.readFileSync(mobileNavPath, 'utf-8');

  // Both sidebar and mobileNav must import from officer-nav-items
  assert.equal(
    /from\s+['"]\.\/officer-nav-items['"]/.test(sidebarContent),
    true,
    'OfficerSidebar must import from officer-nav-items'
  );
  assert.equal(
    /from\s+['"]\.\/officer-nav-items['"]/.test(mobileNavContent),
    true,
    'OfficerMobileNav must import from officer-nav-items'
  );

  const expectedOrder = [
    { name: 'Dashboard', href: '/officer/dashboard' },
    { name: 'New Borrower', href: '/officer/borrowers/new' },
    { name: 'Applications', href: '/officer/queue' },
    { name: 'Current Borrowers', href: '/officer/borrowers' },
    { name: 'Credit Assessments', href: '/officer/credit-assessments' }
  ];

  // Source of truth must have exact names and order
  const namesInOrder = [...navItemsContent.matchAll(/name:\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
  assert.deepEqual(
    namesInOrder,
    expectedOrder.map(e => e.name),
    'OFFICER_NAV_ITEMS must have exact 5 names in order'
  );
});

test('Issue 3: Current Borrowers page must render visible on-screen modals for Details and Ledger', () => {
  const borrowersPagePath = path.join(projectRoot, 'src/app/officer/borrowers/page.tsx');
  const borrowersContent = fs.readFileSync(borrowersPagePath, 'utf-8');

  // Must have a render branch for detailsModalBorrower
  const rendersDetailsModal = /\{detailsModalBorrower\s*&&\s*(\(\s*\(\s*\)\s*=>|[\(<])/.test(borrowersContent);
  assert.equal(
    rendersDetailsModal,
    true,
    'src/app/officer/borrowers/page.tsx must have an on-screen modal render branch for detailsModalBorrower'
  );

  // Must have a render branch for ledgerModalBorrower
  const rendersLedgerModal = /\{ledgerModalBorrower\s*&&\s*(\(\s*\(\s*\)\s*=>|[\(<])/.test(borrowersContent);
  assert.equal(
    rendersLedgerModal,
    true,
    'src/app/officer/borrowers/page.tsx must have an on-screen modal render branch for ledgerModalBorrower'
  );
});
