import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PAGE_PATH = path.join(ROOT, 'src/app/admin/dashboard/page.tsx');
const CSS_PATH = path.join(ROOT, 'src/app/admin/dashboard/dashboard.module.css');
const THEME_CSS_PATH = path.join(ROOT, 'src/components/admin/AdminTheme.module.css');

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function extractCssModuleClasses(cssText) {
  // Strip block comments before extracting class selectors
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

test('Admin Dashboard: every styles.* class referenced in page.tsx exists in dashboard.module.css', () => {
  const pageSrc = readFile(PAGE_PATH);
  const cssSrc = readFile(CSS_PATH);

  const referenced = extractReferencedModuleClasses(pageSrc, 'styles');
  const defined = extractCssModuleClasses(cssSrc);

  assert.ok(referenced.size > 0, 'Expected page.tsx to reference CSS module classes via styles.*');

  const missing = [...referenced].filter((cls) => !defined.has(cls));
  assert.deepEqual(
    missing,
    [],
    `page.tsx references styles.* classes not defined in dashboard.module.css: ${missing.join(', ')}`
  );
});

test('Admin Dashboard: every theme.* class referenced in page.tsx exists in AdminTheme.module.css', () => {
  const pageSrc = readFile(PAGE_PATH);
  const themeCssSrc = readFile(THEME_CSS_PATH);

  const referenced = extractReferencedModuleClasses(pageSrc, 'theme');
  const defined = extractCssModuleClasses(themeCssSrc);

  assert.ok(referenced.size > 0, 'Expected page.tsx to reference theme.* classes');

  const missing = [...referenced].filter((cls) => !defined.has(cls));
  assert.deepEqual(
    missing,
    [],
    `page.tsx references theme.* classes not defined in AdminTheme.module.css: ${missing.join(', ')}`
  );
});

test('Admin Dashboard: desktop table and mobile cards use established mutually exclusive CSS-module containers', () => {
  const pageSrc = readFile(PAGE_PATH);
  const cssSrc = readFile(CSS_PATH);

  // Page uses established stylesheet container classes
  for (const requiredClass of [
    'tableCard',
    'tableHeaderRow',
    'tableTitle',
    'tableSub',
    'desktopTableWrap',
    'dataTable',
    'mobileCardsWrap',
    'mobileAppCard',
    'mobileAppHeader',
    'mobileAppBorrower',
    'mobileAppId',
    'mobileAppDetails',
  ]) {
    assert.ok(
      pageSrc.includes(`styles.${requiredClass}`),
      `Expected page.tsx to use styles.${requiredClass}`
    );
  }

  // Page must not emit dead mismatched class names
  for (const deadClass of [
    'boardCard',
    'boardHeader',
    'boardTitle',
    'boardSubtitle',
    'tableWrap',
    'theadRow',
    'mobileList',
    'mobileItem',
    'mobileItemHeader',
    'mobileItemMeta',
    'statChangeUp',
    'statChangeWarn',
  ]) {
    assert.ok(
      !pageSrc.includes(`styles.${deadClass}`),
      `page.tsx must not reference mismatched class styles.${deadClass}`
    );
  }

  // Stylesheet desktop default: desktopTableWrap visible & horizontally scrollable; mobileCardsWrap hidden
  assert.match(
    cssSrc,
    /\.desktopTableWrap\s*\{[^}]*display:\s*block;[^}]*overflow-x:\s*auto;/s,
    'Expected .desktopTableWrap to be display: block with overflow-x: auto on desktop'
  );
  assert.match(
    cssSrc,
    /\.mobileCardsWrap\s*\{[^}]*display:\s*none;/s,
    'Expected .mobileCardsWrap to be display: none on desktop'
  );

  // Stylesheet table prevents column crushing at narrow desktop/tablet widths
  assert.match(
    cssSrc,
    /\.dataTable\s*\{[^}]*width:\s*100%;[^}]*min-width:\s*\d+px;/s,
    'Expected .dataTable to define width: 100% and a protective min-width for horizontal overflow'
  );

  // Stylesheet mobile breakpoint <=768px swaps visibility mutually exclusively
  const mobileMediaMatch = cssSrc.match(/@media\s*\(max-width:\s*768px\)\s*\{([\s\S]*)\}\s*$/);
  assert.ok(mobileMediaMatch, 'Expected @media (max-width: 768px) block in dashboard.module.css');
  const mobileBlock = mobileMediaMatch[1];

  assert.match(
    mobileBlock,
    /\.desktopTableWrap\s*\{[^}]*display:\s*none;/s,
    'Expected .desktopTableWrap to be display: none at <=768px'
  );
  assert.match(
    mobileBlock,
    /\.mobileCardsWrap\s*\{[^}]*display:\s*flex;/s,
    'Expected .mobileCardsWrap to be display: flex at <=768px'
  );
});
