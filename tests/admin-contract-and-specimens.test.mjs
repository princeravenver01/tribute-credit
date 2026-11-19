import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const MAPPER_PATH = path.join(ROOT, 'src/lib/borrower-record-mapper.ts');
const MODAL_TSX_PATH = path.join(ROOT, 'src/components/admin/AdminBorrowerDetailsModal.tsx');
const MODAL_CSS_PATH = path.join(ROOT, 'src/components/admin/AdminBorrowerDetailsModal.module.css');

function readIfExists(filePath) {
  assert.ok(fs.existsSync(filePath), `Expected file to exist: ${filePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

function extractCssModuleClasses(cssText) {
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

test('Test A: Admin passbook mapping in AdminBorrowerDetailsModal supplies specimenSignature and specimenSignatures, not borrowerSignature(s)', () => {
  const modalTsx = readIfExists(MODAL_TSX_PATH);

  // Must map specimenSignature and specimenSignatures
  assert.ok(
    modalTsx.includes('specimenSignature:'),
    'AdminBorrowerDetailsModal passbookData must map specimenSignature'
  );
  assert.ok(
    modalTsx.includes('specimenSignatures:'),
    'AdminBorrowerDetailsModal passbookData must map specimenSignatures'
  );

  // Must NOT supply dead unsupported keys
  assert.ok(
    !modalTsx.includes('borrowerSignature:'),
    'AdminBorrowerDetailsModal passbookData must not map borrowerSignature'
  );
  assert.ok(
    !modalTsx.includes('borrowerSignatures: borrowerSigs'),
    'AdminBorrowerDetailsModal passbookData must not map borrowerSignatures'
  );
});

test('Test B: Mapper carries contractTemplateSnapshot immutably and preserves all three specimen signature fields', async () => {
  const mapper = await import('../src/lib/borrower-record-mapper.ts');

  const sampleRecord = {
    id: 'CA-TEST-001',
    applicationId: 'TC-LN-TEST-001',
    borrowerName: 'Juan Dela Cruz',
    status: 'contract_ready',
    finalContractAmount: 30000,
    contractExecutedAt: '2026-11-19T10:00:00.000Z',
    contractTemplateSnapshot: {
      version: 'v1.4-snapshot',
      updatedAt: 'November 15, 2026',
      sections: {
        promissoryTitle: 'HISTORICAL PROMISSORY NOTE',
        promissoryHtml: '<p>Pay {{principal}} to Tribute</p>',
        defaultTitle: 'HISTORICAL DEFAULT',
        defaultHtml: '<p>Default conditions</p>',
        privacyTitle: 'HISTORICAL PRIVACY',
        privacyHtml: '<p>Privacy law</p>',
      },
    },
    borrowerSignatures: [
      { signature: 'data:image/png;base64,sig1', authId: 'AUTH-BRW-001', timestamp: '2026-11-19 10:01:00' },
      { signature: 'data:image/png;base64,sig2', authId: 'AUTH-BRW-002', timestamp: '2026-11-19 10:02:00' },
      { signature: 'data:image/png;base64,sig3', authId: 'AUTH-BRW-003', timestamp: '2026-11-19 10:03:00' },
    ],
  };

  const vm = mapper.buildBorrowerDetailsViewModel(sampleRecord);

  // Specimen signatures
  assert.equal(vm.signatures.borrowerSignatures.length, 3);
  assert.equal(vm.signatures.borrowerSignatures[0].authId, 'AUTH-BRW-001');
  assert.equal(vm.signatures.borrowerSignatures[0].signature, 'data:image/png;base64,sig1');
  assert.equal(vm.signatures.borrowerSignatures[0].timestamp, '2026-11-19 10:01:00');
  assert.equal(vm.signatures.borrowerSignatures[1].authId, 'AUTH-BRW-002');
  assert.equal(vm.signatures.borrowerSignatures[2].authId, 'AUTH-BRW-003');

  // Contract snapshot
  assert.ok(vm.contract, 'ViewModel must expose contract section');
  assert.equal(vm.contract.contractTemplateSnapshot?.version, 'v1.4-snapshot');
  assert.equal(vm.contract.contractTemplateSnapshot?.sections.promissoryTitle, 'HISTORICAL PROMISSORY NOTE');
  assert.equal(vm.contract.finalContractAmount, 30000);
  assert.equal(vm.contract.contractExecutedAt, '2026-11-19T10:00:00.000Z');

  // When snapshot missing: must be null, never fabricated
  const sparseRecord = { id: 'CA-TEST-SPARSE', borrowerName: 'Empty Record' };
  const sparseVm = mapper.buildBorrowerDetailsViewModel(sparseRecord);
  assert.equal(sparseVm.contract.contractTemplateSnapshot, null);
});

test('Test C: Documents & Signatures tab exposes stored executed contract snapshot and never calls getActiveContractTemplate()', () => {
  const modalTsx = readIfExists(MODAL_TSX_PATH);

  // Must NOT import or call getActiveContractTemplate (which would load editable live template)
  assert.ok(
    !modalTsx.includes('getActiveContractTemplate'),
    'AdminBorrowerDetailsModal must never call getActiveContractTemplate() for executed loans'
  );

  // Must render contract snapshot section
  assert.ok(
    modalTsx.includes('Executed Contract') || modalTsx.includes('E-Signed Contract Snapshot'),
    'Must render Executed Contract section'
  );

  // Must render honest unavailable state when absent
  assert.ok(
    modalTsx.includes('Executed contract snapshot not available for this record'),
    'Must display honest message when snapshot is missing'
  );

  // Must expose View Contract and Print Contract actions
  assert.ok(
    modalTsx.includes('View Contract') || modalTsx.includes('View Executed Contract'),
    'Must include View Contract action'
  );
  assert.ok(
    modalTsx.includes('Print Contract'),
    'Must include Print Contract action'
  );

  // CSS module check
  const modalCss = readIfExists(MODAL_CSS_PATH);
  const referenced = extractReferencedModuleClasses(modalTsx, 'styles');
  const defined = extractCssModuleClasses(modalCss);
  const missing = [...referenced].filter((cls) => !defined.has(cls));
  assert.deepEqual(missing, [], `AdminBorrowerDetailsModal references missing CSS classes: ${missing.join(', ')}`);
});
