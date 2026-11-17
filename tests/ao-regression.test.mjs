import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { sanitizeProfileUpdate, validatePasswordUpdate } from '../src/lib/officer-account.ts';

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

test('Issue 4: Dashboard View File links deep-link to /officer/borrowers passbook and Current Borrowers consumes it without loop', () => {
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

test('Issue 5: Modal X is positioned in upper-right corner with aria-labels on every borrower modal', () => {
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

test('Issue 6: Desktop sidebar collapse selector matches CSS Module and preserves mobile off-canvas drawer', () => {
  const sidebarPath = path.join(projectRoot, 'src/components/officer/OfficerSidebar.tsx');
  const sidebarCssPath = path.join(projectRoot, 'src/components/officer/OfficerChrome.module.css');

  const sidebarContent = fs.readFileSync(sidebarPath, 'utf-8');
  const sidebarCss = fs.readFileSync(sidebarCssPath, 'utf-8');

  // 1. JSX must emit an explicit CSS module class for collapsed/toggled state (e.g. styles.sidebarCollapsed or styles.sidebarToggled)
  // or a properly scoped :global(.drawer-open) selector
  const emitsLocalCollapseClass = /styles\.(sidebarCollapsed|sidebarToggled)/.test(sidebarContent);
  const targetsLocalCollapseClass = /\.(sidebarCollapsed|sidebarToggled)/.test(sidebarCss);

  assert.equal(
    emitsLocalCollapseClass,
    true,
    'OfficerSidebar JSX must emit a local CSS module class (e.g. styles.sidebarCollapsed) when isMobileOpen is true'
  );
  assert.equal(
    targetsLocalCollapseClass,
    true,
    'OfficerChrome.module.css must target the local collapse class in the desktop min-width rule'
  );

  // 2. JSX must still pass literal drawer-open for <=992px mobile off-canvas behavior
  assert.equal(
    /drawer-open/.test(sidebarContent),
    true,
    'OfficerSidebar JSX must retain drawer-open class for mobile drawer compatibility'
  );

  // 3. Desktop collapsed rule must use clean width 0 without over-shifting negative margins
  const hasCleanCollapse = /@media\s*\(\s*min-width:\s*(993px|992px|1024px)\s*\)[^{]*\{[\s\S]*?\.(sidebarCollapsed|sidebarToggled)[^{]*\{[\s\S]*?width:\s*0/m.test(sidebarCss);
  assert.equal(hasCleanCollapse, true, 'Desktop collapsed rule must collapse width to 0 cleanly');
});

test('Issue 7: AO Sidebar modernization and Account Settings utility link', () => {
  const sidebarPath = path.join(projectRoot, 'src/components/officer/OfficerSidebar.tsx');
  const navItemsPath = path.join(projectRoot, 'src/components/officer/officer-nav-items.ts');
  const sidebarCssPath = path.join(projectRoot, 'src/components/officer/OfficerChrome.module.css');

  const sidebarContent = fs.readFileSync(sidebarPath, 'utf-8');
  const navItemsContent = fs.readFileSync(navItemsPath, 'utf-8');
  const sidebarCss = fs.readFileSync(sidebarCssPath, 'utf-8');

  // 1. Account Settings utility link must exist in OfficerSidebar
  const hasSettingsLink = /href=["']\/officer\/settings["']/.test(sidebarContent);
  assert.equal(hasSettingsLink, true, 'OfficerSidebar must include a link to /officer/settings');

  // 2. Account Settings must NOT be in OFFICER_NAV_ITEMS (to preserve the 5 bottom nav items)
  const navHasSettings = /href:\s*['"]\/officer\/settings['"]/.test(navItemsContent);
  assert.equal(navHasSettings, false, 'OFFICER_NAV_ITEMS must NOT contain /officer/settings');

  // 3. Settings link must be placed in or adjacent to footer before Sign Out Desk
  const settingsBeforeSignOut = sidebarContent.indexOf('/officer/settings') < sidebarContent.indexOf('Sign Out Desk');
  assert.equal(settingsBeforeSignOut, true, 'Account Settings must appear above Sign Out Desk in the footer section');

  // 4. Modern sidebar styles: removed heavy green gradient header
  const hasHeavyGradientHeader = /\.sidebarBrandHeader[^{]*\{[^}]*background:\s*linear-gradient/m.test(sidebarCss);
  assert.equal(hasHeavyGradientHeader, false, 'Modern AO sidebar must remove the heavy green linear-gradient brand header');
});

test('Issue 8: /officer/settings route exists and provides functional account management', () => {
  const settingsPagePath = path.join(projectRoot, 'src/app/officer/settings/page.tsx');
  const settingsApiRoutePath = path.join(projectRoot, 'src/app/api/officer/account/route.ts');

  assert.equal(fs.existsSync(settingsPagePath), true, 'src/app/officer/settings/page.tsx must exist');
  assert.equal(fs.existsSync(settingsApiRoutePath), true, 'src/app/api/officer/account/route.ts must exist');

  const settingsContent = fs.readFileSync(settingsPagePath, 'utf-8');
  const apiContent = fs.readFileSync(settingsApiRoutePath, 'utf-8');

  // Settings page must consume OfficerSidebar, AppHeader, and OfficerMobileNav
  assert.equal(/OfficerSidebar/.test(settingsContent), true, 'Settings page must include OfficerSidebar');
  assert.equal(/AppHeader/.test(settingsContent), true, 'Settings page must include AppHeader');
  assert.equal(/OfficerMobileNav/.test(settingsContent), true, 'Settings page must include OfficerMobileNav');

  // API route must enforce account_officer role via verifyJwtToken
  assert.equal(/verifyJwtToken/.test(apiContent), true, 'API route must call verifyJwtToken');
  assert.equal(/account_officer/.test(apiContent), true, 'API route must require account_officer role');

  // Ensure GET does not return password hash
  const getHandler = apiContent.match(/export async function GET[\s\S]*?(?=export async function PATCH)/)?.[0] || '';
  const returnsPasswordInGet = /password\s*:/i.test(getHandler);
  assert.equal(returnsPasswordInGet, false, 'GET response must not expose password field');
});

test('Issue 9: Helper tests for profile sanitization and password validation logic', async () => {
  // Test sanitizeProfileUpdate
  const rawPayload = {
    name: 'Officer Juan De La Cruz',
    contact_number: '0917-123-4567',
    email: 'hacked@evil.com',
    role: 'admin',
    status: 'active',
    id: 1,
    member_no: 'TCID-ADMIN'
  };

  const sanitized = sanitizeProfileUpdate(rawPayload);
  assert.deepEqual(sanitized, {
    name: 'Officer Juan De La Cruz',
    contact_number: '0917-123-4567'
  });
  assert.equal(sanitized.email, undefined, 'Email must not be editable');
  assert.equal(sanitized.role, undefined, 'Role must not be editable');
  assert.equal(sanitized.id, undefined, 'Id must not be editable');

  // Test validatePasswordUpdate
  const currentPlain = 'Password123!';
  const currentHash = await bcrypt.hash(currentPlain, 10);

  // 1. Wrong current password
  const failCurrent = await validatePasswordUpdate({
    currentPassword: 'WrongPassword!',
    newPassword: 'BrandNewPassword123!',
    confirmPassword: 'BrandNewPassword123!',
    storedPasswordHash: currentHash
  });
  assert.equal(failCurrent.valid, false);
  assert.equal(failCurrent.error, 'Current password verification failed.');

  // 2. Less than 8 chars
  const failShort = await validatePasswordUpdate({
    currentPassword: currentPlain,
    newPassword: 'short',
    confirmPassword: 'short',
    storedPasswordHash: currentHash
  });
  assert.equal(failShort.valid, false);
  assert.equal(failShort.error, 'New password must be at least 8 characters long.');

  // 3. Mismatch confirmation
  const failMismatch = await validatePasswordUpdate({
    currentPassword: currentPlain,
    newPassword: 'BrandNewPassword123!',
    confirmPassword: 'DifferentPassword123!',
    storedPasswordHash: currentHash
  });
  assert.equal(failMismatch.valid, false);
  assert.equal(failMismatch.error, 'New password and confirmation do not match.');

  // 4. Same as current password
  const failSame = await validatePasswordUpdate({
    currentPassword: currentPlain,
    newPassword: currentPlain,
    confirmPassword: currentPlain,
    storedPasswordHash: currentHash
  });
  assert.equal(failSame.valid, false);
  assert.equal(failSame.error, 'New password must be different from the current password.');

  // 5. Successful validation
  const success = await validatePasswordUpdate({
    currentPassword: currentPlain,
    newPassword: 'BrandNewPassword123!',
    confirmPassword: 'BrandNewPassword123!',
    storedPasswordHash: currentHash
  });
  assert.equal(success.valid, true);
});
