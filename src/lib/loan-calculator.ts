export function calculateMonthlyAmortization(principal: number, annualInterestRatePercent: number, termMonths: number) {
  if (termMonths <= 0 || principal <= 0) return 0;
  
  // Standard diminishing / monthly interest calculation common in cooperatives:
  // Simple interest amortization: (Principal + Total Interest) / Term in months
  const monthlyRate = (annualInterestRatePercent / 100) / 12;
  
  if (monthlyRate === 0) {
    return principal / termMonths;
  }
  
  // Amortization formula: M = P * [ r(1 + r)^n ] / [ (1 + r)^n – 1]
  const factor = Math.pow(1 + monthlyRate, termMonths);
  const monthlyPayment = (principal * monthlyRate * factor) / (factor - 1);
  return Math.round(monthlyPayment * 100) / 100;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(amount);
}
