import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SETTINGS_STORE_PATH = path.join(ROOT, 'src/lib/settings-store.ts');
const SETTINGS_PAGE_PATH = path.join(ROOT, 'src/app/admin/settings/page.tsx');
const SETTINGS_CSS_PATH = path.join(ROOT, 'src/app/admin/settings/settings.module.css');
const SETTINGS_API_PATH = path.join(ROOT, 'src/app/api/admin/settings/route.ts');

function readIfExists(filePath) {
  assert.ok(fs.existsSync(filePath), `Expected file to exist: ${filePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

test('Milestone 5 Test A: Settings store persists cooperative identity, preferences, and non-destructive defaults', async () => {
  assert.ok(fs.existsSync(SETTINGS_STORE_PATH), 'src/lib/settings-store.ts must exist');
  const store = await import('../src/lib/settings-store.ts');

  assert.equal(typeof store.getCoopSettings, 'function');
  assert.equal(typeof store.saveCoopSettings, 'function');

  const defaults = await store.getCoopSettings();
  assert.ok(defaults.coopName.includes('Tribute Credit Cooperative'));
  assert.ok(defaults.cdaRegistrationNo.includes('NCR-COOP-88219'));
  assert.equal(defaults.currencySymbol, '₱');

  // Verify save and reload
  const updated = await store.saveCoopSettings({
    ...defaults,
    branchName: 'Commonwealth Main Branch',
    loanIdPrefix: 'TC-LN-2026',
  });
  assert.equal(updated.ok, true);
  assert.equal(updated.settings?.branchName, 'Commonwealth Main Branch');
  assert.equal(updated.settings?.loanIdPrefix, 'TC-LN-2026');
});

test('Milestone 5 Test B: Settings API route handles GET and POST with validation', () => {
  assert.ok(fs.existsSync(SETTINGS_API_PATH), 'src/app/api/admin/settings/route.ts must exist');
  const apiSrc = readIfExists(SETTINGS_API_PATH);
  assert.ok(apiSrc.includes('export async function GET'), 'API must have GET handler');
  assert.ok(apiSrc.includes('export async function POST'), 'API must have POST handler');
});

test('Milestone 5 Test C: Admin Settings UI provides form sections, secure password change, and CSS module contract', () => {
  assert.ok(fs.existsSync(SETTINGS_PAGE_PATH), 'src/app/admin/settings/page.tsx must exist');
  assert.ok(fs.existsSync(SETTINGS_CSS_PATH), 'src/app/admin/settings/settings.module.css must exist');
  const pageSrc = readIfExists(SETTINGS_PAGE_PATH);
  const cssSrc = readIfExists(SETTINGS_CSS_PATH);

  // Key sections
  assert.ok(pageSrc.includes('Cooperative Identity') || pageSrc.includes('Cooperative & Branch'), 'Must have Coop Identity section');
  assert.ok(pageSrc.includes('Operational Preferences') || pageSrc.includes('System Defaults'), 'Must have preferences section');
  assert.ok(pageSrc.includes('Security Credentials') || pageSrc.includes('Password'), 'Must have security/password section');

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
  assert.deepEqual(missing, [], `Settings page references missing CSS classes: ${missing.join(', ')}`);
});
