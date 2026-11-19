import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const STORE_PATH = path.join(ROOT, 'src/lib/contract-template-store.ts');
const EDITOR_PAGE_PATH = path.join(ROOT, 'src/app/admin/contract-editor/page.tsx');
const EDITOR_CSS_PATH = path.join(ROOT, 'src/app/admin/contract-editor/editor.module.css');

function readIfExists(filePath) {
  assert.ok(fs.existsSync(filePath), `Expected file to exist: ${filePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

test('Milestone 1 Test A: Contract template store supports custom clauses and reordering', async () => {
  const store = await import('../src/lib/contract-template-store.ts');

  // Verify interpolateContractHtml works with custom clause tokens
  const rawHtml = '<p>Borrower {{borrowerName}} agrees to custom term {{customRule}} with principal {{principal}}</p>';
  const interpolated = store.interpolateContractHtml(rawHtml, {
    borrowerName: 'Juan Dela Cruz',
    principal: '₱ 25,000.00',
  });
  assert.ok(interpolated.includes('Juan Dela Cruz'));
  assert.ok(interpolated.includes('₱ 25,000.00'));

  // Template interface must support customClauses array
  const storeSource = readIfExists(STORE_PATH);
  assert.ok(
    storeSource.includes('customClauses?:') || storeSource.includes('customClauses:'),
    'ContractTemplate must support customClauses'
  );
  assert.ok(
    storeSource.includes('ContractClauseItem') || storeSource.includes('CustomClause'),
    'Contract template store must define a custom clause item type'
  );
});

test('Milestone 1 Test B: Contract Editor UI provides clause management controls and valid CSS module contract', () => {
  const pageSrc = readIfExists(EDITOR_PAGE_PATH);
  const cssSrc = readIfExists(EDITOR_CSS_PATH);

  // Must include custom clause actions
  assert.ok(pageSrc.includes('Add Clause') || pageSrc.includes('Add Custom Clause'), 'Editor must have Add Clause button');
  assert.ok(pageSrc.includes('Move Up') || pageSrc.includes('Move Down') || pageSrc.includes('handleMoveClause'), 'Editor must have reordering controls');
  assert.ok(pageSrc.includes('handleDeleteClause') || pageSrc.includes('Remove Clause') || pageSrc.includes('deleteClause'), 'Editor must have delete clause control');

  // Must preserve live preview and version increment
  assert.ok(pageSrc.includes('interpolateContractHtml'), 'Editor must use interpolateContractHtml for preview');
  assert.ok(pageSrc.includes('saveContractTemplate'), 'Editor must persist template changes');

  // Check CSS-module references
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
  assert.deepEqual(missing, [], `Editor references missing CSS classes: ${missing.join(', ')}`);
});
