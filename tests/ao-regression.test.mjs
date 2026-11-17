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

test('New Fix 1: Dashboard View File links deep-link to /officer/borrowers passbook and Current Borrowers consumes it without loop', () => {
  const dashboardPath = path.join(projectRoot, 'src/app/officer/dashboard/page.tsx');
  const dashboardContent = fs.readFileSync(dashboardPath, 'utf-8');

  // No View File link in dashboard may target /officer/borrowers/new
  const targetsBorrowersNew = /href=["']\/officer\/borrowers\/new["'][^>]*>\s*<Eye[^>]*>\s*View File/i.test(dashboardContent) ||
    /View File[\s\S]{1,100}href=["']\/officer\/borrowers\/new["']/i.test(dashboardContent);
  assert.equal(targetsBorrowersNew, false, 'Dashboard View File links must not target /officer/borrowers/new');

  // Dashboard must link to /officer/borrowers with viewPassbook parameter
  const deepLinksToPassbook = /href=\{?`\/officer\/borrowers\?viewPassbook=\$\{[^}]+\}`\}?/i.test(dashboardContent) ||
    /href=\{`\/officer\/borrowers\?viewPassbook=/i.test(dashboardContent);
  assert.equal(deepLinksToPassbook, true, 'Dashboard View File links must deep link to /officer/borrowers?viewPassbook=...');

  // Current borrowers page must handle viewPassbook
  const borrowersPath = path.join(projectRoot, 'src/app/officer/borrowers/page.tsx');
  const borrowersContent = fs.readFileSync(borrowersPath, 'utf-8');

  const handlesViewPassbook = /viewPassbook/.test(borrowersContent);
  assert.equal(handlesViewPassbook, true, 'Current Borrowers page must handle viewPassbook parameter');

  // Must set both passbookModalBorrower and selectedBorrowerForLedger when resolving viewPassbook
  const setsPassbookAndLedger = /setPassbookModalBorrower/.test(borrowersContent) && /setSelectedBorrowerForLedger/.test(borrowersContent);
  assert.equal(setsPassbookAndLedger, true, 'Current Borrowers must set passbookModalBorrower and selectedBorrowerForLedger');

  // Must prevent endless reopening loop (e.g. consuming/clearing the param or ref guard)
  const hasGuardAgainstLoop = /viewPassbookHandled|handledPassbookParam|window\.history\.replaceState|replaceState\(null,\s*['"]['"],\s*window\.location\.pathname\)/.test(borrowersContent);
  assert.equal(hasGuardAgainstLoop, true, 'Current Borrowers must guard against reopening loop on polling');
});

test('New Fix 2: Modal X is positioned in upper-right corner with aria-labels on every borrower modal', () => {
  const borrowersCssPath = path.join(projectRoot, 'src/app/officer/borrowers/borrowers.module.css');
  const borrowersCss = fs.readFileSync(borrowersCssPath, 'utf-8');

  // modalDialog or modalHeader must be positioned (relative)
  const headerOrDialogPositioned = /\.modalDialog[^{]*\{[^}]*position:\s*relative/m.test(borrowersCss) ||
    /\.modalHeader[^{]*\{[^}]*position:\s*relative/m.test(borrowersCss);
  assert.equal(headerOrDialogPositioned, true, '.modalDialog or .modalHeader must have position: relative');

  // modalCloseBtn must be absolute at top/right
  const closeBtnAbsolute = /\.modalCloseBtn[^{]*\{[^}]*position:\s*absolute/m.test(borrowersCss) &&
    /\.modalCloseBtn[^{]*\{[^}]*top:/m.test(borrowersCss) &&
    /\.modalCloseBtn[^{]*\{[^}]*right:/m.test(borrowersCss);
  assert.equal(closeBtnAbsolute, true, '.modalCloseBtn must have position: absolute with top and right');

  const borrowersPagePath = path.join(projectRoot, 'src/app/officer/borrowers/page.tsx');
  const borrowersContent = fs.readFileSync(borrowersPagePath, 'utf-8');

  // All 6 modals (Passbook, Ledger, Details, Pay Loan, Savings, Renewal) must have accessible aria-label on close button
  const ariaLabels = [...borrowersContent.matchAll(/aria-label=["']Close ([^"']+)["']/gi)];
  assert.equal(ariaLabels.length >= 6, true, `Must have at least 6 accessible Close modal aria-labels (found ${ariaLabels.length})`);
});

test('New Fix 3: Desktop sidebar collapse and functional toggle in all AO pages', () => {
  const chromeCssPath = path.join(projectRoot, 'src/components/officer/OfficerChrome.module.css');
  const globalsCssPath = path.join(projectRoot, 'src/app/globals.css');
  const chromeCss = fs.readFileSync(chromeCssPath, 'utf-8');
  const globalsCss = fs.readFileSync(globalsCssPath, 'utf-8');

  // Desktop media query (>992px) or min-width: 993px should hide backdrop
  const hidesBackdropOnDesktop = /@media\s*\(\s*min-width:\s*(993px|992px|1024px)\s*\)[^{]*\{[\s\S]*?\.backdrop[^{]*\{[^}]*display:\s*none/m.test(chromeCss) ||
    /@media\s*\(\s*min-width:\s*(993px|992px|1024px)\s*\)[^{]*\{[\s\S]*?\.backdrop[^{]*\{[^}]*display:\s*none/m.test(globalsCss);
  assert.equal(hidesBackdropOnDesktop, true, 'OfficerChrome.module.css or globals.css must hide .backdrop on desktop (>992px)');

  // Desktop sidebar collapse style for .sidebar.drawer-open or .officer-desktop-sidebar.drawer-open
  const hasDesktopCollapse = /@media\s*\(\s*min-width:\s*(993px|992px|1024px)\s*\)[^{]*\{[\s\S]*?\.(sidebar|officer-desktop-sidebar)\.drawer-open[^{]*\{[\s\S]*?(width:\s*0|transform:\s*translateX\(-100%\)|margin-left:\s*-)/m.test(chromeCss) ||
    /@media\s*\(\s*min-width:\s*(993px|992px|1024px)\s*\)[^{]*\{[\s\S]*?\.(sidebar|officer-desktop-sidebar)\.drawer-open[^{]*\{[\s\S]*?(width:\s*0|transform:\s*translateX\(-100%\)|margin-left:\s*-)/m.test(globalsCss);
  assert.equal(hasDesktopCollapse, true, 'Must have desktop rules to collapse sidebar when drawer-open is active on desktop');

  // All 5 AO pages must use functional toggle (setMobileMenuOpen(prev => !prev))
  const officerPages = [
    'src/app/officer/dashboard/page.tsx',
    'src/app/officer/queue/page.tsx',
    'src/app/officer/borrowers/new/page.tsx',
    'src/app/officer/borrowers/page.tsx',
    'src/app/officer/credit-assessments/page.tsx'
  ];

  for (const pageRel of officerPages) {
    const pageContent = fs.readFileSync(path.join(projectRoot, pageRel), 'utf-8');
    const togglesFunctional = /onOpenMobileSidebar=\{\(\)\s*=>\s*setMobileMenuOpen\((prev\s*=>\s*!prev|!mobileMenuOpen)\)\}/.test(pageContent);
    assert.equal(togglesFunctional, true, `${pageRel} AppHeader onOpenMobileSidebar must toggle state`);
  }
});
