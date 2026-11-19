export interface DynamicLoanProduct {
  id?: string;
  name: string;
  description?: string;
  initialMin: number;
  initialMax: number;
  increment: number;
  absoluteMax: number;
  minTerm: number;
  maxTerm: number;
  monthlyInterestRate: number; // e.g. 0.06 (6%)
  monthlyServiceChargeRate: number; // e.g. 0.015 (1.5%)
  cbuRate: number; // e.g. 0.05 (5%)
  cbuMinimum: number; // e.g. 500
  status: 'active' | 'inactive';
}

export const INITIAL_PRODUCTS: DynamicLoanProduct[] = [
  {
    id: 'prod-regular',
    name: 'Regular Loan',
    description: 'Standard microfinance working capital facility for established sari-sari stores and livelihood members.',
    initialMin: 1000,
    initialMax: 20000,
    increment: 5000,
    absoluteMax: 50000,
    minTerm: 2,
    maxTerm: 6,
    monthlyInterestRate: 0.06,
    monthlyServiceChargeRate: 0.015,
    cbuRate: 0.05,
    cbuMinimum: 500,
    status: 'active',
  },
  {
    id: 'prod-sbl',
    name: 'Small Business Loan',
    description: 'Expansion facility for registered micro-enterprises with existing retail inventories or inventory turnover.',
    initialMin: 1000,
    initialMax: 100000,
    increment: 5000,
    absoluteMax: 200000,
    minTerm: 2,
    maxTerm: 6,
    monthlyInterestRate: 0.06,
    monthlyServiceChargeRate: 0.015,
    cbuRate: 0.05,
    cbuMinimum: 500,
    status: 'active',
  },
  {
    id: 'prod-emergency',
    name: 'Emergency Loan',
    description: 'Short-term medical, disaster relief, or hospital emergency credit facility with expedited processing.',
    initialMin: 1000,
    initialMax: 10000,
    increment: 5000,
    absoluteMax: 30000,
    minTerm: 2,
    maxTerm: 6,
    monthlyInterestRate: 0.06,
    monthlyServiceChargeRate: 0.015,
    cbuRate: 0.05,
    cbuMinimum: 500,
    status: 'active',
  },
];

const STORAGE_KEY = 'tribute_dynamic_loan_products';

let memoryProducts: DynamicLoanProduct[] = [...INITIAL_PRODUCTS];

export async function listProducts(): Promise<DynamicLoanProduct[]> {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Fallback to memory
    }
  }
  return memoryProducts;
}

export async function getProductByName(name: string): Promise<DynamicLoanProduct | null> {
  const products = await listProducts();
  const match = products.find((p) => p.name.trim().toLowerCase() === name.trim().toLowerCase());
  return match || null;
}

export async function saveProduct(
  product: DynamicLoanProduct
): Promise<{ ok: boolean; product?: DynamicLoanProduct; error?: string }> {
  if (!product.name?.trim()) {
    return { ok: false, error: 'Product name is required' };
  }
  if (product.initialMin < 0 || product.initialMax < product.initialMin) {
    return { ok: false, error: 'Initial Minimum amount must be less than or equal to Initial Maximum amount' };
  }
  if (product.absoluteMax < product.initialMax) {
    return { ok: false, error: 'Absolute Maximum amount must be greater than or equal to Initial Maximum' };
  }
  if (product.minTerm <= 0 || product.maxTerm < product.minTerm) {
    return { ok: false, error: 'Minimum term must be at least 1 month and less than or equal to maximum term' };
  }
  if (product.monthlyInterestRate < 0 || product.monthlyServiceChargeRate < 0 || product.cbuRate < 0) {
    return { ok: false, error: 'Rates cannot be negative' };
  }

  const currentProducts = await listProducts();
  const existingIdx = currentProducts.findIndex(
    (p) => p.name.trim().toLowerCase() === product.name.trim().toLowerCase() || (product.id && p.id === product.id)
  );

  const savedItem: DynamicLoanProduct = {
    ...product,
    id: product.id || `prod-${Date.now()}`,
    name: product.name.trim(),
  };

  let updatedList: DynamicLoanProduct[];
  if (existingIdx >= 0) {
    updatedList = [...currentProducts];
    updatedList[existingIdx] = savedItem;
  } else {
    updatedList = [...currentProducts, savedItem];
  }

  memoryProducts = updatedList;

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
      window.dispatchEvent(new Event('tribute_products_updated'));
    } catch {
      // Ignore localStorage error
    }
  }

  return { ok: true, product: savedItem };
}
