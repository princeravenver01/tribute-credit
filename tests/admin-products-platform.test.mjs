import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PRODUCT_STORE_PATH = path.join(ROOT, 'src/lib/product-store.ts');
const PRODUCTS_PAGE_PATH = path.join(ROOT, 'src/app/admin/products/page.tsx');
const PRODUCTS_CSS_PATH = path.join(ROOT, 'src/app/admin/products/products.module.css');
const PRODUCTS_API_PATH = path.join(ROOT, 'src/app/api/admin/products/route.ts');

function readIfExists(filePath) {
  assert.ok(fs.existsSync(filePath), `Expected file to exist: ${filePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

test('Milestone 3 Test A: Product store provides dynamic products, calculation integration, and validation', async () => {
  assert.ok(fs.existsSync(PRODUCT_STORE_PATH), 'src/lib/product-store.ts must exist');
  const prodStore = await import('../src/lib/product-store.ts');

  assert.equal(typeof prodStore.listProducts, 'function');
  assert.equal(typeof prodStore.saveProduct, 'function');
  assert.equal(typeof prodStore.getProductByName, 'function');

  const products = await prodStore.listProducts();
  assert.ok(Array.isArray(products), 'Products must be returned as an array');
  assert.ok(products.length >= 3, 'Must contain standard default products');

  // Verify default Regular Loan exists
  const regLoan = products.find((p) => p.name === 'Regular Loan');
  assert.ok(regLoan, 'Regular Loan must exist in products list');
  assert.equal(regLoan.monthlyInterestRate, 0.06);

  // Validation: cannot save product where min > max
  const invalidSave = await prodStore.saveProduct({
    name: 'Invalid Test Loan',
    initialMin: 50000,
    initialMax: 10000,
    increment: 5000,
    absoluteMax: 10000,
    minTerm: 1,
    maxTerm: 6,
    monthlyInterestRate: 0.06,
    monthlyServiceChargeRate: 0.015,
    cbuRate: 0.05,
    cbuMinimum: 500,
    status: 'active',
  });
  assert.equal(invalidSave.ok, false, 'Should reject product where min > max');

  // Test integration with calculateTributeLoan
  const engine = await import('../src/lib/tribute-loan-engine.ts');
  const calc = engine.calculateTributeLoan(10000, 3, 'Regular Loan', 'Monthly');
  assert.equal(calc.principal, 10000);
  assert.equal(calc.totalInterest, 1800); // 10000 * 0.06 * 3
});

test('Milestone 3 Test B: Products API route handles GET and POST with validation', () => {
  assert.ok(fs.existsSync(PRODUCTS_API_PATH), 'src/app/api/admin/products/route.ts must exist');
  const apiSrc = readIfExists(PRODUCTS_API_PATH);
  assert.ok(apiSrc.includes('export async function GET'), 'API must have GET handler');
  assert.ok(apiSrc.includes('export async function POST'), 'API must have POST handler');
});

test('Milestone 3 Test C: Products UI page provides calculator bench, product management, and CSS-module contract', () => {
  assert.ok(fs.existsSync(PRODUCTS_PAGE_PATH), 'src/app/admin/products/page.tsx must exist');
  assert.ok(fs.existsSync(PRODUCTS_CSS_PATH), 'src/app/admin/products/products.module.css must exist');
  const pageSrc = readIfExists(PRODUCTS_PAGE_PATH);
  const cssSrc = readIfExists(PRODUCTS_CSS_PATH);

  // Key UI features
  assert.ok(pageSrc.includes('Add Loan Product') || pageSrc.includes('Create Product'), 'Must have Add Product button');
  assert.ok(pageSrc.includes('Calculator') || pageSrc.includes('Test Bench') || pageSrc.includes('Live Loan Calculation'), 'Must have calculator test bench');
  assert.ok(pageSrc.includes('Interest Rate') || pageSrc.includes('Interest'), 'Must render interest rate settings');

  // CSS module contract
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
  assert.deepEqual(missing, [], `Products page references missing CSS classes: ${missing.join(', ')}`);
});
