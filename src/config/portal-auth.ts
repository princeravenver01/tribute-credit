export type PortalKey = 'borrower' | 'officer' | 'admin';

export type PortalRole = 'borrower' | 'account_officer' | 'admin' | 'disbursement';

export type PortalVariant = 'borrower' | 'officer' | 'admin';

export interface PortalConfig {
  key: PortalKey;
  hostname: string;
  expectedRole: Exclude<PortalRole, 'disbursement'>;
  allowedRoles: readonly PortalRole[];
  loginPath: string;
  dashboardPath: string;
  protectedPrefixes: readonly string[];
  variant: PortalVariant;
  portalLabel: string;
  title: string;
  supportingText: string;
  actionLabel: string;
  identityHeading: string;
  identityCopy: string;
  accessNotice?: string;
}

export const PORTAL_CONFIGS: Record<PortalKey, PortalConfig> = {
  borrower: {
    key: 'borrower',
    hostname: 'credit.tribute-grace.com',
    expectedRole: 'borrower',
    allowedRoles: ['borrower'],
    loginPath: '/borrower/login',
    dashboardPath: '/borrower/dashboard',
    protectedPrefixes: ['/borrower'],
    variant: 'borrower',
    portalLabel: 'Member Portal',
    title: 'Welcome back',
    supportingText: 'Sign in to view your loans, payments, savings, and account.',
    actionLabel: 'Sign in to Member Portal',
    identityHeading: 'Your cooperative credit, in one secure place.',
    identityCopy: 'Review your active loans, payment history, savings ledger, and account information from any device.',
  },
  officer: {
    key: 'officer',
    hostname: 'ao-credit.tribute-grace.com',
    expectedRole: 'account_officer',
    allowedRoles: ['account_officer'],
    loginPath: '/officer/login',
    dashboardPath: '/officer/dashboard',
    protectedPrefixes: ['/officer'],
    variant: 'officer',
    portalLabel: 'Account Officer Portal',
    title: 'Sign in to Field Desk',
    supportingText: 'Access borrower assessments, applications, disbursement confirmation, and account records.',
    actionLabel: 'Sign in to Field Desk',
    identityHeading: 'Field underwriting with clear accountability.',
    identityCopy: 'Continue borrower intake, credit assessment, approvals tracking, and verified disbursement workflows.',
    accessNotice: 'Authorized personnel only',
  },
  admin: {
    key: 'admin',
    hostname: 'admin-credit.tribute-grace.com',
    expectedRole: 'admin',
    allowedRoles: ['admin', 'disbursement'],
    loginPath: '/admin/login',
    dashboardPath: '/admin/dashboard',
    protectedPrefixes: ['/admin', '/disbursement'],
    variant: 'admin',
    portalLabel: 'Administration Portal',
    title: 'Sign in to Admin Console',
    supportingText: 'Access approvals, governance, users, products, reports, and system settings.',
    actionLabel: 'Sign in to Admin Console',
    identityHeading: 'Cooperative governance with complete oversight.',
    identityCopy: 'Manage approvals, releases, policies, users, products, reporting, and audit-ready records.',
    accessNotice: 'Restricted administrative access',
  },
};

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.$/, '').split(':')[0];
}

function pathMatchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function getPortalForHostname(hostname: string): PortalConfig | null {
  const normalized = normalizeHostname(hostname);
  return Object.values(PORTAL_CONFIGS).find((portal) => portal.hostname === normalized) ?? null;
}

export function getPortalForPath(pathname: string): PortalConfig | null {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return (
    Object.values(PORTAL_CONFIGS).find((portal) =>
      portal.protectedPrefixes.some((prefix) => pathMatchesPrefix(normalizedPath, prefix)),
    ) ?? null
  );
}

export function roleCanAccessPortal(role: PortalRole, portal: PortalConfig): boolean {
  return portal.allowedRoles.includes(role);
}
