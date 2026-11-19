// Contract Template & Versioning System for Tribute Credit Cooperative
// Supports Rich Text / HTML Editing via Admin Panel
// Enforces Immutability: Executed contracts store their snapshot and never change when admin edits templates

export interface ContractClauseItem {
  id: string;
  title: string;
  html: string;
  order: number;
  isRequired?: boolean;
  tag?: string;
}

export interface ContractTemplate {
  version: string; // e.g. "v1.2"
  updatedAt: string; // e.g. "November 5, 2026 08:50 PM"
  updatedBy: string; // e.g. "Admin / Dennis Yuan"
  title: string;
  subTitle: string;
  legalNotice: string;
  sections: {
    promissoryTitle: string;
    promissoryHtml: string;
    defaultTitle: string;
    defaultHtml: string;
    privacyTitle: string;
    privacyHtml: string;
    additionalClausesHtml?: string;
  };
  customClauses?: ContractClauseItem[];
}

export const DEFAULT_CONTRACT_TEMPLATE: ContractTemplate = {
  version: 'v1.0',
  updatedAt: 'November 5, 2026',
  updatedBy: 'System Super Administrator',
  title: 'MICROFINANCE PROMISSORY NOTE & CREDIT FACILITY AGREEMENT',
  subTitle: 'Executed pursuant to R.A. 9510 (Credit Information System Act) & R.A. 8792 (E-Commerce Act of the Philippines)',
  legalNotice: 'Regulated Microfinance Facility Agreement governed under CDA Code & Republic Acts of the Philippines.',
  sections: {
    promissoryTitle: 'PROMISSORY NOTE & UNCONDITIONAL PROMISE TO PAY',
    promissoryHtml: `FOR VALUE RECEIVED, I/we hereby unconditionally promise to pay to the order of <strong>TRIBUTE CREDIT COOPERATIVE</strong> at its office in Commonwealth Ave., Quezon City, Metro Manila, the aggregate sum of <strong>{{totalScheduledCollections}}</strong>, payable through amortized installments as scheduled in this Agreement in the amount of <strong>{{installmentAmount}}</strong> every <strong>{{repaymentFrequency}}</strong> across <strong>{{termMonths}} Months</strong>.`,
    defaultTitle: 'ACCELERATION CLAUSE & DEFAULT REMEDIES',
    defaultHtml: `Failure to pay any single installment when due shall render the entire remaining balance immediately due, demandable, and executory without need of prior formal judicial notice or demand. A penalty surcharge of <strong>3.00% per month</strong> on overdue amortizations shall automatically accrue. The member-borrower pledges and assigns their <strong>Capital Build-Up (CBU)</strong> savings equity as secondary collateral for the total settlement of this facility.`,
    privacyTitle: 'DATA PRIVACY & E-SIGNATURE LEGALITY',
    privacyHtml: `The borrower expressly authorizes Tribute Credit Cooperative to collect, record, process, and disclose financial credit information pursuant to <strong>Republic Act No. 10173 (Data Privacy Act of 2012)</strong> and <strong>Republic Act No. 9510</strong>. All digital stylus signatures and authenticated hash IDs affixed herein carry full legal equivalence to wet ink signatures pursuant to <strong>Republic Act No. 8792 (Electronic Commerce Act)</strong>.`,
    additionalClausesHtml: `The borrower confirms that all declared income sources, residential addresses, dependants, and business operations are true, correct, and verified during the live intake interview with the Account Officer.`
  },
  customClauses: []
};

const TEMPLATE_STORAGE_KEY = 'tribute_contract_template_current';
const TEMPLATE_HISTORY_KEY = 'tribute_contract_template_history';

/**
 * Retrieves the active contract template.
 * If running on server or no custom template saved, returns DEFAULT_CONTRACT_TEMPLATE.
 */
export function getActiveContractTemplate(): ContractTemplate {
  if (typeof window === 'undefined') {
    return DEFAULT_CONTRACT_TEMPLATE;
  }

  try {
    const raw = localStorage.getItem(TEMPLATE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_CONTRACT_TEMPLATE,
        ...parsed,
        sections: {
          ...DEFAULT_CONTRACT_TEMPLATE.sections,
          ...(parsed.sections || {})
        },
        customClauses: Array.isArray(parsed.customClauses)
          ? parsed.customClauses.sort((a: ContractClauseItem, b: ContractClauseItem) => (a.order || 0) - (b.order || 0))
          : []
      };
    }
  } catch (e) {
    console.error('Failed to load active contract template:', e);
  }

  return DEFAULT_CONTRACT_TEMPLATE;
}

/**
 * Saves a new contract template from Admin Panel.
 * Automatically archives the previous version to the history log.
 */
export function saveContractTemplate(template: ContractTemplate): void {
  if (typeof window === 'undefined') return;

  try {
    const current = getActiveContractTemplate();
    
    // Archive previous version if version or date changed
    const historyRaw = localStorage.getItem(TEMPLATE_HISTORY_KEY);
    const history: ContractTemplate[] = historyRaw ? JSON.parse(historyRaw) : [];
    history.unshift({ ...current });
    // Keep last 20 revisions
    localStorage.setItem(TEMPLATE_HISTORY_KEY, JSON.stringify(history.slice(0, 20)));

    // Save active
    localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(template));

    // Broadcast change across tabs
    window.dispatchEvent(new Event('tribute_contract_template_updated'));
  } catch (e) {
    console.error('Failed to save contract template:', e);
  }
}

/**
 * Returns revision history of past contract templates.
 */
export function getContractTemplateHistory(): ContractTemplate[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = localStorage.getItem(TEMPLATE_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Replaces placeholders like {{totalScheduledCollections}}, {{repaymentFrequency}}, etc.
 */
export function interpolateContractHtml(
  html: string,
  variables: {
    totalScheduledCollections?: string;
    installmentAmount?: string;
    repaymentFrequency?: string;
    termMonths?: string | number;
    principal?: string;
    borrowerName?: string;
    policyNo?: string;
  }
): string {
  if (!html) return '';
  let result = html;
  if (variables.totalScheduledCollections) {
    result = result.replace(/\{\{totalScheduledCollections\}\}/g, variables.totalScheduledCollections);
  }
  if (variables.installmentAmount) {
    result = result.replace(/\{\{installmentAmount\}\}/g, variables.installmentAmount);
  }
  if (variables.repaymentFrequency) {
    result = result.replace(/\{\{repaymentFrequency\}\}/g, variables.repaymentFrequency);
  }
  if (variables.termMonths !== undefined) {
    result = result.replace(/\{\{termMonths\}\}/g, String(variables.termMonths));
  }
  if (variables.principal) {
    result = result.replace(/\{\{principal\}\}/g, variables.principal);
  }
  if (variables.borrowerName) {
    result = result.replace(/\{\{borrowerName\}\}/g, variables.borrowerName);
  }
  if (variables.policyNo) {
    result = result.replace(/\{\{policyNo\}\}/g, variables.policyNo);
  }
  return result;
}

