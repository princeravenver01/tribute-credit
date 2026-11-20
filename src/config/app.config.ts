export const APP_CONFIG = {
  appName: 'Tribute Credit Cooperative',
  version: '1.0.0',
  defaultCurrency: 'PHP',
  currencySymbol: '₱',
  routes: {
    admin: {
      dashboard: '/admin/dashboard',
      loans: '/admin/loans',
      users: '/admin/users',
      products: '/admin/products',
      reports: '/admin/reports',
      settings: '/admin/settings',
    },
    accountOfficer: {
      dashboard: '/officer/dashboard',
      queue: '/officer/queue',
      borrowers: '/officer/borrowers',
      disbursements: '/officer/disbursements',
      collections: '/officer/collections',
    },
    borrower: {
      dashboard: '/borrower/dashboard',
      apply: '/borrower/apply',
      loans: '/borrower/my-loans',
      calculator: '/borrower/calculator',
      payments: '/borrower/payments',
      profile: '/borrower/profile',
    },
    auth: {
      login: '/login',
      register: '/register',
    }
  },
  roles: {
    ADMIN: 'admin',
    ACCOUNT_OFFICER: 'account_officer',
    BORROWER: 'borrower',
  }
} as const;
