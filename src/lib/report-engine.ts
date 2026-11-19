export interface PortfolioMetrics {
  totalApplications: number;
  approvedCount: number;
  rejectedCount: number;
  contractReadyCount: number;
  awaitingAoReleaseCount: number;
  disbursedCount: number;
  pendingAssessmentCount: number;
  pendingAdminCount: number;
  disbursedVolume: number;
  totalCollected: number;
  totalRemainingBalance: number;
  totalCbuSavings: number;
  approvalRatePct: number;
  productMix: { name: string; count: number; volume: number }[];
  aoPerformance: { officer: string; total: number; disbursed: number; volume: number }[];
}

export function calculatePortfolioMetrics(records: any[]): PortfolioMetrics {
  let totalApplications = 0;
  let approvedCount = 0;
  let rejectedCount = 0;
  let contractReadyCount = 0;
  let awaitingAoReleaseCount = 0;
  let disbursedCount = 0;
  let pendingAssessmentCount = 0;
  let pendingAdminCount = 0;
  let disbursedVolume = 0;
  let totalCollected = 0;
  let totalRemainingBalance = 0;
  let totalCbuSavings = 0;

  const productMap = new Map<string, { count: number; volume: number }>();
  const aoMap = new Map<string, { total: number; disbursed: number; volume: number }>();

  for (const r of records) {
    totalApplications += 1;
    const principal = Number(r.finalContractAmount ?? r.adminApprovedAmount ?? r.officerAdjustedAmount ?? r.amountRequested ?? 0);
    const prodName = r.productName || 'Regular Loan';
    const officer = r.evaluatedByOfficer || 'Unassigned AO';

    // Status aggregation
    switch (r.status) {
      case 'disbursed':
        disbursedCount += 1;
        approvedCount += 1;
        disbursedVolume += principal;
        totalCollected += Number(r.totalCollected || 0);
        totalRemainingBalance += Number(r.remainingBalance || 0);
        totalCbuSavings += Number(r.savingsBalance || 0);
        break;
      case 'pending_ao_disbursement':
        awaitingAoReleaseCount += 1;
        approvedCount += 1;
        break;
      case 'contract_ready':
        contractReadyCount += 1;
        approvedCount += 1;
        break;
      case 'admin_approved':
        approvedCount += 1;
        break;
      case 'rejected':
        rejectedCount += 1;
        break;
      case 'pending_admin':
        pendingAdminCount += 1;
        break;
      default:
        pendingAssessmentCount += 1;
        break;
    }

    // Product breakdown
    const pEntry = productMap.get(prodName) || { count: 0, volume: 0 };
    pEntry.count += 1;
    if (r.status === 'disbursed') {
      pEntry.volume += principal;
    }
    productMap.set(prodName, pEntry);

    // AO breakdown
    const aoEntry = aoMap.get(officer) || { total: 0, disbursed: 0, volume: 0 };
    aoEntry.total += 1;
    if (r.status === 'disbursed') {
      aoEntry.disbursed += 1;
      aoEntry.volume += principal;
    }
    aoMap.set(officer, aoEntry);
  }

  const approvalRatePct = totalApplications > 0 ? (approvedCount / totalApplications) * 100 : 0;

  const productMix = Array.from(productMap.entries()).map(([name, data]) => ({
    name,
    count: data.count,
    volume: data.volume,
  }));

  const aoPerformance = Array.from(aoMap.entries()).map(([officer, data]) => ({
    officer,
    total: data.total,
    disbursed: data.disbursed,
    volume: data.volume,
  }));

  return {
    totalApplications,
    approvedCount,
    rejectedCount,
    contractReadyCount,
    awaitingAoReleaseCount,
    disbursedCount,
    pendingAssessmentCount,
    pendingAdminCount,
    disbursedVolume,
    totalCollected,
    totalRemainingBalance,
    totalCbuSavings,
    approvalRatePct,
    productMix,
    aoPerformance,
  };
}

export function generateLoanCsv(records: any[]): string {
  const headers = [
    'Loan Reference',
    'Borrower Name',
    'Product',
    'Status',
    'Principal',
    'Total Collected',
    'Remaining Balance',
    'Evaluated By',
  ];

  const rows = records.map((r) => {
    const loanRef = r.applicationId || r.id;
    const rawName = r.borrowerName || '';
    const name = rawName.includes(',') || rawName.includes('"')
      ? `"${rawName.replace(/"/g, '""')}"`
      : rawName;
    const prod = r.productName || 'Regular Loan';
    const status = r.status || 'unknown';
    const principal = Number(r.finalContractAmount ?? r.adminApprovedAmount ?? 0);
    const collected = Number(r.totalCollected || 0);
    const balance = Number(r.remainingBalance || 0);
    const officer = r.evaluatedByOfficer || 'Unassigned';

    return [loanRef, name, prod, status, principal, collected, balance, officer].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}
