'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  CreditCard, 
  Coins, 
  Settings, 
  LogOut, 
  Building2, 
  User 
} from 'lucide-react';
import styles from './BorrowerNav.module.css';

interface BorrowerNavProps {
  user?: {
    name?: string;
    email?: string;
    memberNo?: string;
  } | null;
  coopSettings?: {
    coopName?: string;
    branchName?: string;
  } | null;
}

export const BORROWER_NAV_ITEMS = [
  { label: 'Dashboard', href: '/borrower/dashboard', icon: LayoutDashboard },
  { label: 'Loans', href: '/borrower/loans', icon: CreditCard },
  { label: 'Savings', href: '/borrower/savings', icon: Coins },
  { label: 'Account Settings', href: '/borrower/settings', icon: Settings },
] as const;

export function BorrowerNav({ user, coopSettings }: BorrowerNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore
    }
    router.push('/borrower/login');
  };

  return (
    <>
      <header className={styles.navShell}>
        <div className={styles.navContainer}>
          <div className={styles.brandGroup}>
            <div className={styles.brandLogo}>
              <Building2 size={20} />
            </div>
            <div className={styles.brandText}>
              <span className={styles.brandTitle}>
                {coopSettings?.coopName || 'Tribute Credit Cooperative'}
              </span>
              <span className={styles.brandSubtitle}>
                {coopSettings?.branchName ? `${coopSettings.branchName} • ` : ''}Member Portal
              </span>
            </div>
          </div>

          {/* Desktop 4 navigation links */}
          <nav className={styles.desktopNav} aria-label="Borrower Desktop Navigation">
            {BORROWER_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== '/borrower/dashboard' && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User actions */}
          <div className={styles.userGroup}>
            {user?.memberNo && (
              <div className={styles.memberPill}>
                <User size={13} />
                <span>{user.memberNo}</span>
              </div>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className={styles.logoutBtn}
              title="Sign Out of Portal"
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar */}
      <nav className={styles.mobileBottomNav} aria-label="Borrower Mobile Navigation">
        <div className={styles.mobileNavInner}>
          {BORROWER_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/borrower/dashboard' && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.mobileNavItem} ${isActive ? styles.mobileNavItemActive : ''}`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
