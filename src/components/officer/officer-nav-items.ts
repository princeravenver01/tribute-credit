import {
  LayoutDashboard,
  UserPlus,
  FileSpreadsheet,
  Users2,
  BadgeCheck,
  Wallet,
  LucideIcon
} from 'lucide-react';

export interface OfficerNavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  isPrimary?: boolean;
}

export const OFFICER_NAV_ITEMS: OfficerNavItem[] = [
  { name: 'Dashboard', href: '/officer/dashboard', icon: LayoutDashboard },
  { name: 'New Borrower', href: '/officer/borrowers/new', icon: UserPlus, isPrimary: true },
  { name: 'Applications', href: '/officer/queue', icon: FileSpreadsheet, badge: 'Draft Vault' },
  { name: 'Current Borrowers', href: '/officer/borrowers', icon: Users2 },
  { name: 'Credit Assessments', href: '/officer/credit-assessments', icon: BadgeCheck },
  { name: 'Disbursements', href: '/officer/disbursements', icon: Wallet },
];
