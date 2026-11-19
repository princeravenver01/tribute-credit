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

test('Issue 10: Queue submitted applications link directly to Credit Assessments with stable ID', () => {
  const queuePagePath = path.join(projectRoot, 'src/app/officer/queue/page.tsx');
  const queueContent = fs.readFileSync(queuePagePath, 'utf-8');

  // Must have actions linking to /officer/credit-assessments?assessId=... or similar
  const hasCreditAssessmentLink = /href=\{[`'"]\/officer\/credit-assessments\?assessId=\$\{[^}]+[`'"]\}/.test(queueContent) ||
    /\/officer\/credit-assessments\?assessId=/.test(queueContent);
  assert.equal(hasCreditAssessmentLink, true, 'Queue page must have link to /officer/credit-assessments with assessId');

  // Must have "Start Credit Assessment" for unassessed/pending records
  assert.equal(
    /Start Credit Assessment/.test(queueContent),
    true,
    'Queue page must render "Start Credit Assessment" button for pending_assessment'
  );

  // Must have "View Credit Assessment" for already assessed/in-progress records
  assert.equal(
    /View Credit Assessment/.test(queueContent),
    true,
    'Queue page must render "View Credit Assessment" button for assessed records'
  );

  // Credit assessments page must consume the query parameter and resolve applicant after merge
  const caPagePath = path.join(projectRoot, 'src/app/officer/credit-assessments/page.tsx');
  const caContent = fs.readFileSync(caPagePath, 'utf-8');

  assert.equal(
    /assessId/.test(caContent),
    true,
    'Credit assessments page must consume assessId parameter'
  );

  // Must have guard against endless override on 1.5s poller
  const hasGuardAgainstPollOverride = /handledDeepLink|deepLinkHandled|replaceState/.test(caContent);
  assert.equal(
    hasGuardAgainstPollOverride,
    true,
    'Credit assessments page must guard against poller overriding manual selection'
  );
});

test('Issue 11: Pre-approval creates pending_assessment and excludes from Admin queue until AO endorses', () => {
  const newBorrowerPath = path.join(projectRoot, 'src/app/officer/borrowers/new/page.tsx');
  const adminLoansPath = path.join(projectRoot, 'src/app/admin/loans/page.tsx');
  const adminDashboardPath = path.join(projectRoot, 'src/app/admin/dashboard/page.tsx');
  const queuePath = path.join(projectRoot, 'src/app/officer/queue/page.tsx');

  const newBorrowerContent = fs.readFileSync(newBorrowerPath, 'utf-8');
  const adminLoansContent = fs.readFileSync(adminLoansPath, 'utf-8');
  const adminDashboardContent = fs.readFileSync(adminDashboardPath, 'utf-8');
  const queueContent = fs.readFileSync(queuePath, 'utf-8');

  // 1. In new/page.tsx, syncToCreditAssessmentStore should NOT default to pending_admin without isSubmittedToAdmin or prior admin status
  const defaultsToPendingAssessment = /isSubmittedToAdmin\s*\?\s*['"]pending_admin['"]\s*:\s*['"]pending_assessment['"]/.test(newBorrowerContent);
  assert.equal(
    defaultsToPendingAssessment,
    true,
    'syncToCreditAssessmentStore must set pending_assessment for pre-approved applications until AO endorses/submits to admin'
  );

  // 2. In admin/loans/page.tsx, draft injection into admin queue must require isSubmittedToAdmin (not just aiResult or currentStep >= 6)
  const draftRequiresSubmission = /draft\.isSubmittedToAdmin/.test(adminLoansContent) &&
    !/draft\.isSubmittedToAdmin\s*\|\|\s*draft\.aiResult\s*\|\|\s*draft\.currentStep\s*>=\s*6/.test(adminLoansContent);
  assert.equal(
    draftRequiresSubmission,
    true,
    'Admin loans page must not load local draft into admin queue solely because aiResult or currentStep >= 6 exists'
  );

  // 3. In admin/loans/page.tsx, pending approvals count and pending filter must only include pending_admin (NOT pending_assessment)
  const includesPendingAssessmentInAdminLoans = /a\.status\s*===\s*['"]pending_admin['"]\s*\|\|\s*a\.status\s*===\s*['"]pending_assessment['"]/.test(adminLoansContent);
  assert.equal(
    includesPendingAssessmentInAdminLoans,
    false,
    'Admin loans queue and counts must not include pending_assessment records'
  );

  // 4. In admin/dashboard/page.tsx, pending approvals count must only count pending_admin (NOT pending_assessment)
  const includesPendingAssessmentInAdminDashboard = /a\.status\s*===\s*['"]pending_admin['"]\s*\|\|\s*a\.status\s*===\s*['"]pending_assessment['"]/.test(adminDashboardContent);
  assert.equal(
    includesPendingAssessmentInAdminDashboard,
    false,
    'Admin dashboard pending count must not include pending_assessment records'
  );

  // 5. In officer queue/page.tsx, mapping of pending_assessment should be pending_assessment or pending_ai, not pending_admin
  const mapsPendingAssessmentToAdmin = /a\.status\s*===\s*['"]pending_assessment['"]\s*\?\s*['"]pending_admin['"]/.test(queueContent);
  assert.equal(
    mapsPendingAssessmentToAdmin,
    false,
    'Officer queue must not map pending_assessment to pending_admin'
  );
});

test('Issue 12: New Borrower Step 6 has no Submit to Admin or AO adjustment UI and has assessment deep-link CTA; pending_admin originates only in CA endorsement', () => {
  const newBorrowerPath = path.join(projectRoot, 'src/app/officer/borrowers/new/page.tsx');
  const creditAssessmentsPath = path.join(projectRoot, 'src/app/officer/credit-assessments/page.tsx');

  const newBorrowerContent = fs.readFileSync(newBorrowerPath, 'utf-8');
  const caContent = fs.readFileSync(creditAssessmentsPath, 'utf-8');

  // 1. Step 6 must NOT render "Account Officer Amount Adjustment"
  assert.equal(
    /Account Officer Amount Adjustment/.test(newBorrowerContent),
    false,
    'New Borrower Step 6 must not contain Account Officer Amount Adjustment controls'
  );

  // 2. Step 6 must NOT render "Admin Governance Status"
  assert.equal(
    /Admin Governance Status:/.test(newBorrowerContent),
    false,
    'New Borrower Step 6 must not contain Admin Governance Status block'
  );

  // 3. Step 6 must NOT contain "Submit to Admin" or handleSubmitToAdmin
  assert.equal(
    /Submit to Admin/.test(newBorrowerContent),
    false,
    'New Borrower Step 6 must not contain Submit to Admin button'
  );
  assert.equal(
    /handleSubmitToAdmin/.test(newBorrowerContent),
    false,
    'New Borrower page must not wire handleSubmitToAdmin directly to Admin queue'
  );

  // 4. Step 6 must have "Ready for AO Credit Assessment" and "Continue to Credit Assessment" linking to /officer/credit-assessments?assessId=
  assert.equal(
    /Ready for AO Credit Assessment/.test(newBorrowerContent),
    true,
    'New Borrower Step 6 must show "Ready for AO Credit Assessment" status for pending_assessment'
  );
  assert.equal(
    /Continue to Credit Assessment/.test(newBorrowerContent),
    true,
    'New Borrower Step 6 must provide "Continue to Credit Assessment" primary CTA'
  );
  assert.equal(
    /\/officer\/credit-assessments\?assessId=/.test(newBorrowerContent),
    true,
    'New Borrower Step 6 CTA must navigate to /officer/credit-assessments with encoded assessId'
  );

  // 5. Origin of pending_admin in Credit Assessments: handleSaveAssessment(true) sets status: 'pending_admin'
  assert.equal(
    /handleSaveAssessment\s*=\s*(?:async\s*)?\([^)]*submitToAdmin[^)]*\)\s*=>[\s\S]*status:\s*submitToAdmin\s*\?\s*['"]pending_admin['"]/.test(caContent),
    true,
    'Credit assessments page handleSaveAssessment must be the mechanism that transitions record to pending_admin upon endorsement'
  );
});

test('Issue 13: Credit Assessments endorsement reliability, async transactional UI, poll downgrade protection, and API DB mapping', () => {
  const caPagePath = path.join(projectRoot, 'src/app/officer/credit-assessments/page.tsx');
  const apiRoutePath = path.join(projectRoot, 'src/app/api/assessments/route.ts');

  const caContent = fs.readFileSync(caPagePath, 'utf-8');
  const apiContent = fs.readFileSync(apiRoutePath, 'utf-8');

  // 1. GET /api/assessments must differentiate DB 'pending' => 'pending_assessment' and 'under_review' => 'pending_admin'
  const mapsDbPendingToAssessment = /row\.status\s*===\s*['"]pending['"]\s*\?\s*['"]pending_assessment['"]/.test(apiContent);
  const mapsDbUnderReviewToAdmin = /row\.status\s*===\s*['"]under_review['"]\s*\?\s*['"]pending_admin['"]/.test(apiContent);

  assert.equal(
    mapsDbPendingToAssessment,
    true,
    'GET /api/assessments must map DB status pending to pending_assessment'
  );
  assert.equal(
    mapsDbUnderReviewToAdmin,
    true,
    'GET /api/assessments must map DB status under_review to pending_admin'
  );

  // 2. In credit-assessments/page.tsx, handleSaveAssessment must be async and await persistence
  const isSaveAsync = /handleSaveAssessment\s*=\s*async\s*\([^)]*submitToAdmin/.test(caContent);
  assert.equal(
    isSaveAsync,
    true,
    'handleSaveAssessment in credit-assessments page must be async'
  );

  // 3. UI must have an isSubmitting / isEndorsing state that disables button and shows "Endorsing..."
  const hasSubmittingState = /isEndorsing|isSubmitting/.test(caContent);
  const showsEndorsingText = /Endorsing\.\.\./.test(caContent);
  assert.equal(
    hasSubmittingState && showsEndorsingText,
    true,
    'Credit assessments page must provide an in-flight endorsing indicator'
  );

  // 4. Polling/refresh draft integration must NOT downgrade an assessment that is already pending_admin, admin_approved, etc.
  const hasDowngradeProtection = /draft\.isSubmittedToAdmin\s*\?\s*['"]pending_admin['"]\s*:\s*['"]pending_assessment['"]/.test(caContent);
  assert.equal(
    hasDowngradeProtection,
    false,
    'Draft integration in refreshAssessments must not downgrade existing pending_admin assessments'
  );

  // 5. When endorsing, if the item matches local draft, local draft is updated to isSubmittedToAdmin = true
  const updatesDraftOnEndorse = /tribute_new_borrower_draft/.test(caContent) && /isSubmittedToAdmin\s*=\s*true/.test(caContent);
  assert.equal(
    updatesDraftOnEndorse,
    true,
    'Endorsing in Credit Assessments must synchronize the local draft isSubmittedToAdmin flag to true'
  );

  // 6. When already pending_admin or later, the endorsement button must be hidden or disabled
  const handlesEndorsedStatusUi = /selectedAssessment\.status\s*===\s*['"]pending_admin['"]/.test(caContent);
  assert.equal(
    handlesEndorsedStatusUi,
    true,
    'Endorsement button or status UI must specifically handle already endorsed pending_admin status'
  );
});

test('Issue 14: AO Amount Reconsideration Workflow in Credit Assessments and Admin Review Comparison', () => {
  const caPagePath = path.join(projectRoot, 'src/app/officer/credit-assessments/page.tsx');
  const adminLoansPath = path.join(projectRoot, 'src/app/admin/loans/page.tsx');

  const caContent = fs.readFileSync(caPagePath, 'utf-8');
  const adminLoansContent = fs.readFileSync(adminLoansPath, 'utf-8');

  // 1. Credit Assessments must render Request Reconsideration action when status === 'admin_approved'
  const hasRequestReconsideration = /Request Reconsideration/.test(caContent);
  assert.equal(
    hasRequestReconsideration,
    true,
    'Credit assessments page must provide a Request Reconsideration action for admin_approved records'
  );

  // 2. Credit Assessments must enforce validation: amount differs from current adminApprovedAmount, justification non-empty, and adjustmentCount < 3
  const validatesDiffAmount = /officerAmount\s*===\s*selectedAssessment\.adminApprovedAmount/.test(caContent) ||
    /officerAmount\s*!==\s*selectedAssessment\.adminApprovedAmount/.test(caContent);
  assert.equal(
    validatesDiffAmount,
    true,
    'Reconsideration action must validate that recommended amount differs from current adminApprovedAmount'
  );

  // 3. Confirmation dialog/modal specifying previous approved amount, requested amount, and round number
  const hasReconsiderationConfirmation = /confirmReconsideration|Confirm Reconsideration/i.test(caContent);
  assert.equal(
    hasReconsiderationConfirmation,
    true,
    'Reconsideration must confirm previous approved amount, requested amount, and round number'
  );

  // 4. In-flight state "Sending Reconsideration..."
  const hasInFlightReconsideration = /Sending Reconsideration\.\.\./.test(caContent);
  assert.equal(
    hasInFlightReconsideration,
    true,
    'Credit assessments page must have an in-flight Sending Reconsideration... indicator'
  );

  // 5. While pending reconsideration, shows "Awaiting Admin Reconsideration" with Round N of 3, and disables/hides Proceed to Contract
  const showsAwaitingReconsideration = /Awaiting Admin Reconsideration/.test(caContent);
  assert.equal(
    showsAwaitingReconsideration,
    true,
    'Credit assessments page must show Awaiting Admin Reconsideration (Round N of 3)'
  );

  // 6. At 3/3 adjustments reached, disables action and shows limit reached indicator
  const showsLimitReached = /Reconsideration limit reached/.test(caContent);
  assert.equal(
    showsLimitReached,
    true,
    'Credit assessments page must show Reconsideration limit reached at 3/3'
  );

  // 7. Admin Review screen displays Previous Approved Amount, AO Requested Amount, and Justification in Reconsideration view
  const adminShowsPreviousApproved = /Previous Approved|Previous Admin-Approved/i.test(adminLoansContent);
  const adminShowsRequestedAmount = /AO Requested Amount|AO Endorsed Amount/i.test(adminLoansContent);
  assert.equal(
    adminShowsPreviousApproved,
    true,
    'Admin loans screen must display Previous Approved Amount for reconsideration items'
  );
  assert.equal(
    adminShowsRequestedAmount,
    true,
    'Admin loans screen must display AO Requested Amount'
  );
});

test('Issue 15: In-app Reconsideration Confirmation Modal replaces browser confirm popup', () => {
  const caPagePath = path.join(projectRoot, 'src/app/officer/credit-assessments/page.tsx');
  const caContent = fs.readFileSync(caPagePath, 'utf-8');

  // 1. Must NOT use native window.confirm() or confirm() for reconsideration
  const reconsiderationCodeBlock = caContent.slice(
    caContent.indexOf('handleOpenReconsiderationModal'),
    caContent.indexOf('handleSimulateAdminAction')
  );
  const usesNativeConfirmForReconsideration = /(?:window\.)?confirm\s*\(/.test(reconsiderationCodeBlock);
  assert.equal(
    usesNativeConfirmForReconsideration,
    false,
    'Credit assessments page must not use native confirm() dialog for reconsideration'
  );

  // 2. Must render in-app modal with accessible dialog attributes (role="dialog", aria-modal="true")
  const hasDialogRole = /role=["']dialog["']/.test(caContent);
  const hasAriaModal = /aria-modal=["']true["']/.test(caContent);
  assert.equal(
    hasDialogRole && hasAriaModal,
    true,
    'Reconsideration modal must include role="dialog" and aria-modal="true"'
  );

  // 3. Modal header title & subtitle
  assert.equal(
    /Confirm Reconsideration Request/.test(caContent),
    true,
    'Modal must have "Confirm Reconsideration Request" title'
  );

  // 4. Modal actions: "Keep Editing" and "Send for Reconsideration"
  assert.equal(
    /Keep Editing/.test(caContent),
    true,
    'Modal must provide "Keep Editing" secondary dismissal action'
  );
  assert.equal(
    /Send for Reconsideration/.test(caContent),
    true,
    'Modal must provide "Send for Reconsideration" primary action'
  );

  // 5. Upper-right close X button with accessible label
  const hasCloseXWithAria = /aria-label=["']Close reconsideration modal["']|aria-label=["']Close modal["']/.test(caContent) ||
    /aria-label=["']Close["']/.test(caContent);
  assert.equal(
    hasCloseXWithAria,
    true,
    'Modal must contain a top-right close X button with accessible aria-label'
  );

  // 6. Comparison row / display: Current Admin-Approved Amount and AO Requested Amount
  const hasComparisonAmounts = /Current Admin-Approved Amount/.test(caContent) &&
    /AO Requested Amount/.test(caContent);
  assert.equal(
    hasComparisonAmounts,
    true,
    'Modal must display comparison row between Current Admin-Approved Amount and AO Requested Amount'
  );

  // 7. Restrained warning note that contract execution is paused while awaiting Admin
  const hasPausedWarning = /pauses until Admin decides|paused while awaiting Admin|paused until Admin/i.test(caContent);
  assert.equal(
    hasPausedWarning,
    true,
    'Modal must provide warning that contract processing pauses until Admin decides'
  );
});

test('Issue 16: Official Document Signatures and Authorization integrity in Passbook & Contract', () => {
  const passbookPath = path.join(projectRoot, 'src/components/passbook/PassbookBooklet.tsx');
  const borrowersNewPath = path.join(projectRoot, 'src/app/officer/borrowers/new/page.tsx');
  const borrowersPagePath = path.join(projectRoot, 'src/app/officer/borrowers/page.tsx');

  const passbookContent = fs.readFileSync(passbookPath, 'utf-8');
  const borrowersNewContent = fs.readFileSync(borrowersNewPath, 'utf-8');
  const borrowersPageContent = fs.readFileSync(borrowersPagePath, 'utf-8');

  // 1. Hard-coded placeholder strings must be removed from PassbookBooklet
  assert.equal(/ROLANDO_ROBLES/.test(passbookContent), false, 'ROLANDO_ROBLES placeholder must be removed from PassbookBooklet');
  assert.equal(/DENNIS_YUAN/.test(passbookContent), false, 'DENNIS_YUAN placeholder must be removed from PassbookBooklet');
  assert.equal(/OFFICIAL SEAL &bull; VERIFIED/.test(passbookContent), false, 'Decorative OFFICIAL SEAL must be replaced with verification cards');

  // 2. Hard-coded ROLANDO and DENNIS removed from borrowers/page.tsx
  assert.equal(/ROLANDO_ROBLES/.test(borrowersPageContent), false, 'ROLANDO_ROBLES placeholder must be removed from borrowers/page.tsx');
  assert.equal(/DENNIS_YUAN/.test(borrowersPageContent), false, 'DENNIS_YUAN placeholder must be removed from borrowers/page.tsx');

  // 3. New borrower contract print views must not hard-code Officer Juan for COOP APPROVAL
  const coopApprovalBlock = borrowersNewContent.slice(
    borrowersNewContent.indexOf('COOP APPROVAL'),
    borrowersNewContent.indexOf('COOP APPROVAL') + 400
  );
  assert.equal(/Officer Juan \(AO-001\)/.test(coopApprovalBlock), false, 'COOP APPROVAL must not hard-code Officer Juan');

  // 4. Passbook identity header prevents character-by-character breaking for loan reference
  assert.equal(/whiteSpace:\s*['"]nowrap['"]/.test(passbookContent), true, 'Passbook header loan reference must have white-space nowrap');

  // 5. borrowers/new/page.tsx preserves and loads adminSignatures and adminActionAt in draft and assessment sync
  assert.equal(/adminSignatures/.test(borrowersNewContent), true, 'borrowers/new/page.tsx must preserve adminSignatures');
  assert.equal(/adminActionAt/.test(borrowersNewContent), true, 'borrowers/new/page.tsx must preserve adminActionAt');

  // 6. PassbookData interface has explicit aoOfficialSignature and adminOfficialSignature
  assert.equal(/aoOfficialSignature\?:/.test(passbookContent), true, 'PassbookData must include aoOfficialSignature');
  assert.equal(/adminOfficialSignature\?:/.test(passbookContent), true, 'PassbookData must include adminOfficialSignature');

  // 7. No AUTO fallback string for borrower or official signatures
  assert.equal(/AUTH-BRW-00\$\{idx \+ 1\}-AUTO/.test(borrowersNewContent), false, 'AUTH-BRW-AUTO fallback must be removed');
});


