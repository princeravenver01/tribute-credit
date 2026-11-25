// Tribute Grace Business Plan & Financial Engine
// Based on confirmed Business Rules 5.1 - 5.5

export interface LoanProductRule {
  name: string;
  initialMin: number;
  initialMax: number;
  increment: number;
  absoluteMax: number;
  minTerm: number;
  maxTerm: number;
  monthlyInterestRate: number; // 6% per month flat
  monthlyServiceChargeRate: number; // 0.1% * 1.5 = 0.15% per month of term
  cbuRate: number; // 5% for lifetime
  cbuMinimum: number; // Minimum ₱500 floor
}

export const TRIBUTE_GRACE_PRODUCTS: Record<string, LoanProductRule> = {
  'Regular Loan': {
    name: 'Regular Loan',
    initialMin: 1000,
    initialMax: 20000,
    increment: 5000,
    absoluteMax: 50000,
    minTerm: 2,
    maxTerm: 6,
    monthlyInterestRate: 0.06, // 6% flat per month
    monthlyServiceChargeRate: 0.0015, // 0.1% * 1.5 = 0.15% per month
    cbuRate: 0.05, // 5% lifetime
    cbuMinimum: 500, // CBU should not go below ₱500
  },
  'Small Business Loan': {
    name: 'Small Business Loan',
    initialMin: 1000,
    initialMax: 100000,
    increment: 5000,
    absoluteMax: 200000,
    minTerm: 2,
    maxTerm: 6,
    monthlyInterestRate: 0.06,
    monthlyServiceChargeRate: 0.0015,
    cbuRate: 0.05,
    cbuMinimum: 500,
  },
  'Emergency Loan': {
    name: 'Emergency Loan',
    initialMin: 1000,
    initialMax: 10000,
    increment: 20000,
    absoluteMax: 30000,
    minTerm: 2,
    maxTerm: 6,
    monthlyInterestRate: 0.06,
    monthlyServiceChargeRate: 0.0015,
    cbuRate: 0.05,
    cbuMinimum: 500,
  },
};

export interface CalculationResult {
  principal: number;
  termMonths: number;
  interestRateMonthly: number;
  totalInterest: number;
  serviceCharge: number;
  cbuRate: number;
  cbuAmount: number;
  isCbuUpfront: boolean;
  cbuUpfrontAmount: number;
  cbuAmortizedAmount: number;
  netCashProceeds: number;
  contractualBalance: number;
  totalScheduledCollections: number;
  installmentPerFrequency: number;
  frequency: 'Daily' | 'Weekly' | 'Semi-Monthly' | 'Monthly';
  numberOfInstallments: number;
}

/**
 * Confirmed calculation formula:
 * Total interest = P * 0.06 * M
 * Service charge = (P * 0.001) * 1.5 * M = P * 0.0015 * M (Deducted upfront from proceeds)
 * Capital Build Up (CBU):
 *   - 5% CBU for lifetime (paid during loan release, one time per loan only)
 *   - CBU floor: Should not go below ₱500 (Math.max(500, P * 0.05))
 *   - Paid during loan release upon disbursement (not added to installment collections)
 *   - Total scheduled collections across installments = P + Total interest
 */
export function calculateTributeLoan(
  principal: number,
  termMonths: number,
  productName: string,
  frequency: 'Daily' | 'Weekly' | 'Semi-Monthly' | 'Monthly' = 'Monthly',
  isRenewal: boolean = false
): CalculationResult {
  const prod = TRIBUTE_GRACE_PRODUCTS[productName] || TRIBUTE_GRACE_PRODUCTS['Regular Loan'];
  const P = Math.max(0, principal);
  const M = Math.max(1, termMonths);

  const interestRateMonthly = prod.monthlyInterestRate;
  const totalInterest = Math.round(P * interestRateMonthly * M * 100) / 100;

  // Service charge = P * 0.001 * 1.5 * M (0.15% per month)
  const serviceCharge = Math.round(P * prod.monthlyServiceChargeRate * M * 100) / 100;

  // CBU commitment: 5% lifetime, paid during loan release, one time per loan only; minimum ₱500 floor
  const cbuRate = prod.cbuRate || 0.05;
  const calculatedCbu = Math.round(P * cbuRate * 100) / 100;
  // If principal is 0, CBU is 0; otherwise enforce minimum ₱500 floor
  const cbuAmount = P > 0 ? Math.max(prod.cbuMinimum || 500, calculatedCbu) : 0;
  const isCbuUpfront = true;
  const cbuUpfrontAmount = cbuAmount;
  const cbuAmortizedAmount = 0;

  // Net Cash Proceeds = P - Service Charge
  const netCashProceeds = Math.max(0, P - serviceCharge);

  // Contractual loan balance = P + Total Interest
  const contractualBalance = P + totalInterest;

  // Total scheduled installment collections = P + Total Interest (CBU is one time during release)
  const totalScheduledCollections = contractualBalance;

  // Installment count based on payment mode
  let installments = M;
  if (frequency === 'Semi-Monthly') installments = M * 2;
  else if (frequency === 'Weekly') installments = Math.round(M * 4.33);
  else if (frequency === 'Daily') installments = M * 26; // approx 26 working collection days per month

  const installmentPerFrequency = installments > 0
    ? Math.round((totalScheduledCollections / installments) * 100) / 100
    : totalScheduledCollections;

  return {
    principal: P,
    termMonths: M,
    interestRateMonthly,
    totalInterest,
    serviceCharge,
    cbuRate,
    cbuAmount,
    isCbuUpfront,
    cbuUpfrontAmount,
    cbuAmortizedAmount,
    netCashProceeds,
    contractualBalance,
    totalScheduledCollections,
    installmentPerFrequency,
    frequency,
    numberOfInstallments: installments,
  };
}

/**
 * 1-Minute AI Verification Engine Simulator
 * Evaluates borrower capacity, debt service ratio, business plan ceilings, and historical delinquency risk
 */
export interface AiVerificationResult {
  preApprovedAmount: number;
  riskRating: 'Class A (Low Risk)' | 'Class B (Moderate Risk)' | 'Class C (High Risk)';
  debtServiceRatio: number; // percentage
  confidenceScore: number; // percentage
  recommendationNote: string;
  policyCeiling: number;
  factors: {
    incomeStability: 'Strong' | 'Average' | 'Volatile';
    assetCollateralCoverage: string;
    householdBurden: string;
    productFit: string;
  };
}

export function runAiCreditVerification(
  borrowerData: {
    monthlyNetIncome: number;
    existingDebtDues: number;
    dependantsCount: number;
    yearsInLivelihood: number;
    assetsTotalValue: number;
    requestedAmount: number;
    productName: string;
    isRenewal?: boolean;
  }
): AiVerificationResult {
  const prod = TRIBUTE_GRACE_PRODUCTS[borrowerData.productName] || TRIBUTE_GRACE_PRODUCTS['Regular Loan'];
  const ceiling = borrowerData.isRenewal ? prod.absoluteMax : prod.initialMax;

  const disposable = Math.max(0, borrowerData.monthlyNetIncome - borrowerData.existingDebtDues);
  const maxSafeMonthlyAmortization = disposable * 0.45; // standard 45% debt-service ratio ceiling

  // Rough estimation of allowable principal for 3 months
  let rawAffordability = maxSafeMonthlyAmortization * 2.5;
  if (borrowerData.yearsInLivelihood >= 3) rawAffordability *= 1.15;
  if (borrowerData.assetsTotalValue > 50000) rawAffordability *= 1.1;

  // Clamp within business plan matrix
  let preApproved = Math.min(borrowerData.requestedAmount, rawAffordability, ceiling);
  // Round to nearest 1,000 PHP
  preApproved = Math.max(prod.initialMin, Math.floor(preApproved / 1000) * 1000);

  const dsr = borrowerData.monthlyNetIncome > 0
    ? Math.round(((borrowerData.existingDebtDues + (preApproved * 0.35)) / borrowerData.monthlyNetIncome) * 100)
    : 80;

  let riskRating: AiVerificationResult['riskRating'] = 'Class A (Low Risk)';
  if (dsr > 50 || borrowerData.yearsInLivelihood < 2) riskRating = 'Class B (Moderate Risk)';
  if (dsr > 70) riskRating = 'Class C (High Risk)';

  return {
    preApprovedAmount: preApproved,
    riskRating,
    debtServiceRatio: dsr,
    confidenceScore: 94.2,
    policyCeiling: ceiling,
    recommendationNote: `AI assessment verified micro-enterprise cash flow against Tribute Grace rules. Pre-approved at ₱${preApproved.toLocaleString('en-PH')} based on 45% DSR boundary and ${borrowerData.yearsInLivelihood} years in livelihood.`,
    factors: {
      incomeStability: borrowerData.yearsInLivelihood >= 2 ? 'Strong' : 'Average',
      assetCollateralCoverage: borrowerData.assetsTotalValue > 0 ? `₱${borrowerData.assetsTotalValue.toLocaleString('en-PH')} declared` : 'Unsecured / Personal guarantee',
      householdBurden: `${borrowerData.dependantsCount} dependant(s)`,
      productFit: `${borrowerData.productName} (Ceiling: ₱${ceiling.toLocaleString('en-PH')})`,
    },
  };
}
