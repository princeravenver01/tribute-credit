import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PORTAL_CONFIG_PATH = path.join(ROOT, 'src/config/portal-auth.ts');

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
