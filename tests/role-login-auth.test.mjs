import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PORTAL_CONFIG_PATH = path.join(ROOT, 'src/config/portal-auth.ts');
const SHARED_LOGIN_PATH = path.join(ROOT, 'src/components/auth/RoleLoginPage.tsx');
const SHARED_LOGIN_CSS_PATH = path.join(ROOT, 'src/components/auth/RoleLoginPage.module.css');
const LOGIN_PAGE_PATHS = {
  borrower: path.join(ROOT, 'src/app/borrower/login/page.tsx'),
  officer: path.join(ROOT, 'src/app/officer/login/page.tsx'),
  admin: path.join(ROOT, 'src/app/admin/login/page.tsx'),
};

function read(filePath) {
  assert.ok(fs.existsSync(filePath), `Expected file to exist: ${filePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

test('portal configuration defines the three production role hosts and destinations', async () => {
  assert.ok(fs.existsSync(PORTAL_CONFIG_PATH), 'src/config/portal-auth.ts must exist');

  const { PORTAL_CONFIGS } = await import('../src/config/portal-auth.ts');

  assert.deepEqual(Object.keys(PORTAL_CONFIGS), ['borrower', 'officer', 'admin']);
  assert.deepEqual(
    {
      borrower: {
        hostname: PORTAL_CONFIGS.borrower.hostname,
        expectedRole: PORTAL_CONFIGS.borrower.expectedRole,
        loginPath: PORTAL_CONFIGS.borrower.loginPath,
        dashboardPath: PORTAL_CONFIGS.borrower.dashboardPath,
        variant: PORTAL_CONFIGS.borrower.variant,
      },
      officer: {
        hostname: PORTAL_CONFIGS.officer.hostname,
        expectedRole: PORTAL_CONFIGS.officer.expectedRole,
        loginPath: PORTAL_CONFIGS.officer.loginPath,
        dashboardPath: PORTAL_CONFIGS.officer.dashboardPath,
        variant: PORTAL_CONFIGS.officer.variant,
      },
      admin: {
        hostname: PORTAL_CONFIGS.admin.hostname,
        expectedRole: PORTAL_CONFIGS.admin.expectedRole,
        loginPath: PORTAL_CONFIGS.admin.loginPath,
        dashboardPath: PORTAL_CONFIGS.admin.dashboardPath,
        variant: PORTAL_CONFIGS.admin.variant,
      },
    },
    {
      borrower: {
        hostname: 'credit.tribute-grace.com',
        expectedRole: 'borrower',
        loginPath: '/borrower/login',
        dashboardPath: '/borrower/dashboard',
        variant: 'borrower',
      },
      officer: {
        hostname: 'ao-credit.tribute-grace.com',
        expectedRole: 'account_officer',
        loginPath: '/officer/login',
        dashboardPath: '/officer/dashboard',
        variant: 'officer',
      },
      admin: {
        hostname: 'admin-credit.tribute-grace.com',
        expectedRole: 'admin',
        loginPath: '/admin/login',
        dashboardPath: '/admin/dashboard',
        variant: 'admin',
      },
    },
  );
});

test('hostname lookup normalizes case and ports and rejects unknown hosts', async () => {
  assert.ok(fs.existsSync(PORTAL_CONFIG_PATH), 'src/config/portal-auth.ts must exist');
  const { getPortalForHostname } = await import('../src/config/portal-auth.ts');

  assert.equal(getPortalForHostname('CREDIT.TRIBUTE-GRACE.COM:443')?.key, 'borrower');
  assert.equal(getPortalForHostname('ao-credit.tribute-grace.com:3000')?.key, 'officer');
  assert.equal(getPortalForHostname('ADMIN-CREDIT.TRIBUTE-GRACE.COM')?.key, 'admin');
  assert.equal(getPortalForHostname('unknown.tribute-grace.com'), null);
  assert.equal(getPortalForHostname('localhost:3000'), null);
});

test('path lookup maps each portal and keeps disbursement on the admin surface', async () => {
  assert.ok(fs.existsSync(PORTAL_CONFIG_PATH), 'src/config/portal-auth.ts must exist');
  const { getPortalForPath } = await import('../src/config/portal-auth.ts');

  assert.equal(getPortalForPath('/borrower/dashboard')?.key, 'borrower');
  assert.equal(getPortalForPath('/officer/queue')?.key, 'officer');
  assert.equal(getPortalForPath('/admin/users')?.key, 'admin');
  assert.equal(getPortalForPath('/disbursement')?.key, 'admin');
  assert.equal(getPortalForPath('/disbursement/login')?.key, 'admin');
  assert.equal(getPortalForPath('/login'), null);
});

test('portal role access is explicit and admin surface includes the disbursement workflow', async () => {
  assert.ok(fs.existsSync(PORTAL_CONFIG_PATH), 'src/config/portal-auth.ts must exist');
  const { PORTAL_CONFIGS, roleCanAccessPortal } = await import('../src/config/portal-auth.ts');

  assert.equal(roleCanAccessPortal('borrower', PORTAL_CONFIGS.borrower), true);
  assert.equal(roleCanAccessPortal('account_officer', PORTAL_CONFIGS.officer), true);
  assert.equal(roleCanAccessPortal('admin', PORTAL_CONFIGS.admin), true);
  assert.equal(roleCanAccessPortal('disbursement', PORTAL_CONFIGS.admin), true);
  assert.equal(roleCanAccessPortal('borrower', PORTAL_CONFIGS.admin), false);
  assert.equal(roleCanAccessPortal('admin', PORTAL_CONFIGS.borrower), false);
});

test('all three role login routes are thin wrappers around one trusted shared component', () => {
  const sharedSource = read(SHARED_LOGIN_PATH);

  for (const [portalKey, pagePath] of Object.entries(LOGIN_PAGE_PATHS)) {
    const pageSource = read(pagePath);
    assert.match(pageSource, /RoleLoginPage/, `${portalKey} must import RoleLoginPage`);
    assert.match(pageSource, new RegExp(`portalKey=["']${portalKey}["']`));
    assert.doesNotMatch(pageSource, /useState|<form|style=\{\{/);
  }

  assert.match(sharedSource, /from ['"]next\/image['"]/);
  assert.match(sharedSource, /src=["']\/tribute-credit-logo\.png["']/);
});

test('shared login form starts empty and exposes accessible password and request states', () => {
  const source = read(SHARED_LOGIN_PATH);

  assert.match(source, /useState\(['"]['"]\)/, 'login fields must initialize empty');
  assert.match(source, /autoComplete=["']email["']/);
  assert.match(source, /autoComplete=["']current-password["']/);
  assert.match(source, /aria-label=.*(?:Show|Hide).*password/i);
  assert.match(source, /aria-live=["']polite["']/);
  assert.match(source, /disabled=\{loading\}/);
  assert.match(source, /Signing in/);
  assert.match(source, /The email or password is incorrect\.|This account cannot access this portal\.|We could not sign you in right now\./);
  assert.match(source, /JSON\.stringify\(\{\s*email,\s*password\s*\}\)/);
  assert.doesNotMatch(source, /requiredRole|expectedRole\s*:/, 'the client must not select its own login role');
});

test('production login UI contains no demo credentials or cross-portal switching links', () => {
  const sources = [read(SHARED_LOGIN_PATH), ...Object.values(LOGIN_PAGE_PATHS).map(read)].join('\n');

  assert.doesNotMatch(sources, /Password123!|Pass123|Demo Credentials|Demo Disbursement Credentials/i);
  assert.doesNotMatch(sources, /href=["']\/(?:borrower|officer|admin)\/login["']/);
});

test('shared login CSS implements split desktop and safe single-column mobile layouts', () => {
  const css = read(SHARED_LOGIN_CSS_PATH);

  assert.match(css, /grid-template-columns:\s*(?:minmax\([^;]+\)|[^;]+)\s+(?:minmax\([^;]+\)|[^;]+);/);
  assert.match(css, /@media\s*\(max-width:\s*760px\)/);
  assert.match(css, /grid-template-columns:\s*1fr/);
  assert.match(css, /min-height:\s*48px/);
  assert.match(css, /env\(safe-area-inset-top\)/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /overflow-x:\s*hidden/);
  assert.match(css, /@media\s*\(max-width:\s*(?:360|340|320)px\)/);
});
