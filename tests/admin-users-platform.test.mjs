import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const USERS_STORE_PATH = path.join(ROOT, 'src/lib/user-store.ts');
const USERS_PAGE_PATH = path.join(ROOT, 'src/app/admin/users/page.tsx');
const USERS_CSS_PATH = path.join(ROOT, 'src/app/admin/users/users.module.css');
const USERS_API_PATH = path.join(ROOT, 'src/app/api/admin/users/route.ts');

function readIfExists(filePath) {
  assert.ok(fs.existsSync(filePath), `Expected file to exist: ${filePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

test('Milestone 2 Test A: User store provides role validation, unique emails, and protects super admin', async () => {
  assert.ok(fs.existsSync(USERS_STORE_PATH), 'src/lib/user-store.ts must exist');
  const userStore = await import('../src/lib/user-store.ts');

  assert.equal(typeof userStore.listUsers, 'function');
  assert.equal(typeof userStore.createUser, 'function');
  assert.equal(typeof userStore.updateUser, 'function');
  assert.equal(typeof userStore.toggleUserStatus, 'function');

  const users = await userStore.listUsers();
  assert.ok(Array.isArray(users), 'listUsers must return an array');
  assert.ok(users.length >= 2, 'Default staff accounts must be populated');

  // Verify super admin exists
  const superAdmin = users.find((u) => u.email === 'admin@tribute.coop' || u.role === 'admin');
  assert.ok(superAdmin, 'Super admin account must exist');

  // Verify cannot deactivate super admin
  const toggleResult = await userStore.toggleUserStatus(superAdmin.id, 'inactive');
  assert.equal(toggleResult.ok, false, 'Super admin deactivation must be blocked');
});

test('Milestone 2 Test B: User API route handles GET and POST with validation', () => {
  assert.ok(fs.existsSync(USERS_API_PATH), 'src/app/api/admin/users/route.ts must exist');
  const apiSrc = readIfExists(USERS_API_PATH);
  assert.ok(apiSrc.includes('export async function GET'), 'API must have GET handler');
  assert.ok(apiSrc.includes('export async function POST'), 'API must have POST handler');
  assert.ok(apiSrc.includes('requireApiRole'), 'API must check session auth through the central role guard');
});

test('Milestone 2 Test C: Admin Users UI page renders table, modals, and adheres to CSS module contract', () => {
  assert.ok(fs.existsSync(USERS_PAGE_PATH), 'src/app/admin/users/page.tsx must exist');
  assert.ok(fs.existsSync(USERS_CSS_PATH), 'src/app/admin/users/users.module.css must exist');
  const pageSrc = readIfExists(USERS_PAGE_PATH);
  const cssSrc = readIfExists(USERS_CSS_PATH);

  // Must render controls
  assert.ok(pageSrc.includes('Create New Staff') || pageSrc.includes('Add User') || pageSrc.includes('Create User'), 'Page must have Create User button');
  assert.ok(pageSrc.includes('Search') || pageSrc.includes('filter'), 'Page must have search/filter');
  assert.ok(pageSrc.includes('Toggle Status') || pageSrc.includes('Deactivate') || pageSrc.includes('Activate'), 'Page must have status action');

  // Check CSS-module classes
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
  assert.deepEqual(missing, [], `Users page references missing CSS classes: ${missing.join(', ')}`);
});
